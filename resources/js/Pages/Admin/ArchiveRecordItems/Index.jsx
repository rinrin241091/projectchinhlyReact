import AdminLayout from '../../../Layouts/AdminLayout';
import { Head } from '@inertiajs/react';
import { AgGridReact } from 'ag-grid-react';
import { useMemo, useRef, useState } from 'react';

import 'ag-grid-community/styles/ag-theme-quartz.css';

export default function Index({ rows, organizations }) {
    const [rowData, setRowData] = useState(() => rows);
    const gridApiRef = useRef(null);

    const organizationOptions = useMemo(
        () =>
            organizations.map((organization) => ({
                value: organization.id,
                label: organization.name,
            })),
        [organizations],
    );

    const organizationNameById = useMemo(() => {
        const map = new Map();
        organizations.forEach((organization) => {
            map.set(organization.id, organization.name);
        });
        return map;
    }, [organizations]);

    const yearByOrganizationId = useMemo(() => {
        const map = new Map();
        organizations.forEach((organization) => {
            map.set(organization.id, organization.archivals_time ?? '');
        });
        return map;
    }, [organizations]);

    const columnDefs = useMemo(
        () => [
            { field: 'stt', headerName: 'STT', maxWidth: 90, valueGetter: 'node.rowIndex + 1' },
            { field: 'archive_record_item_code', headerName: 'Mã mục lục', maxWidth: 170, editable: true },
            { field: 'title', headerName: 'Tên mục lục', flex: 1.6, editable: true },
            {
                field: 'organization_id',
                headerName: 'Phông',
                flex: 1.4,
                editable: true,
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: {
                    values: organizationOptions.map((option) => option.value),
                },
                valueFormatter: ({ value }) => organizationNameById.get(value) ?? '',
            },
            {
                field: 'year',
                headerName: 'Năm hồ sơ',
                maxWidth: 160,
                valueGetter: ({ data }) =>
                    data?.organization_id ? yearByOrganizationId.get(data.organization_id) ?? '' : '',
            },
            { field: 'description', headerName: 'Ghi chú', flex: 1.8, editable: true },
            {
                headerName: '',
                field: 'actions',
                maxWidth: 120,
                sortable: false,
                filter: false,
                cellRenderer: ({ data }) => (
                    <button
                        type="button"
                        onClick={() => onDelete(data.id)}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-rose-600"
                    >
                        Xóa
                    </button>
                ),
            },
        ],
        [organizationOptions, organizationNameById, yearByOrganizationId],
    );

    const normalizeValue = (field, value) => {
        if (field === 'organization_id') {
            if (value === null || value === undefined || value === '') {
                return null;
            }
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
        }
        return value;
    };

    const isDraftReady = (row) =>
        Boolean(row.archive_record_item_code) && Boolean(row.title) && Boolean(row.organization_id);

    const onCellValueChanged = async (params) => {
        const { data, colDef, newValue, oldValue } = params;

        if (newValue === oldValue) {
            return;
        }

        const normalizedValue = normalizeValue(colDef.field, newValue);

        if (data.isDraft) {
            const updatedDraft = { ...data, [colDef.field]: normalizedValue };

            setRowData((current) =>
                current.map((row) => (row.id === data.id ? updatedDraft : row)),
            );

            if (colDef.field === 'organization_id') {
                params.api.refreshCells({
                    rowNodes: [params.node],
                    columns: ['year'],
                    force: true,
                });
            }

            if (!isDraftReady(updatedDraft)) {
                return;
            }

            try {
                const response = await window.axios.post('/admin/archive-record-items', {
                    archive_record_item_code: updatedDraft.archive_record_item_code,
                    title: updatedDraft.title,
                    description: updatedDraft.description ?? '',
                    organization_id: updatedDraft.organization_id,
                });
                setRowData((current) =>
                    current.map((row) => (row.id === data.id ? response.data : row)),
                );
            } catch (error) {
                alert('Create failed. Please try again.');
            }
            return;
        }

        try {
            await window.axios.patch(`/admin/archive-record-items/${data.id}`, {
                field: colDef.field,
                value: normalizedValue,
            });
            if (colDef.field === 'organization_id') {
                params.api.refreshCells({
                    rowNodes: [params.node],
                    columns: ['year'],
                    force: true,
                });
            }
        } catch (error) {
            params.node.setDataValue(colDef.field, oldValue);
            alert('Update failed. Please check the value and try again.');
        }
    };

    const onAddRow = async () => {
        try {
            const firstOrganization = organizations[0];
            if (!firstOrganization) {
                alert('Vui lòng tạo "Phông lưu trữ" trước.');
                return;
            }

            const minId = rowData.reduce((min, row) => Math.min(min, row.id ?? 0), 0);
            const draftId = minId <= 0 ? minId - 1 : -1;

            const draftRow = {
                id: draftId,
                archive_record_item_code: '',
                title: '',
                description: '',
                organization_id: null,
                year: '',
                isDraft: true,
            };

            setRowData((current) => [...current, draftRow]);
            setTimeout(() => {
                const api = gridApiRef.current;
                if (!api) {
                    return;
                }
                const rowIndex = api.getDisplayedRowCount() - 1;
                if (rowIndex < 0) {
                    return;
                }
                api.startEditingCell({ rowIndex, colKey: 'archive_record_item_code' });
            }, 0);
        } catch (error) {
            alert('Create failed. Please try again.');
        }
    };

    const onDelete = async (id) => {
        if (!confirm('Delete this row?')) {
            return;
        }
        const row = rowData.find((item) => item.id === id);
        if (row?.isDraft) {
            setRowData((current) => current.filter((item) => item.id !== id));
            return;
        }
        try {
            await window.axios.delete(`/admin/archive-record-items/${id}`);
            setRowData((current) => current.filter((row) => row.id !== id));
        } catch (error) {
            alert('Delete failed. Please try again.');
        }
    };

    return (
        <AdminLayout title="Mục lục hồ sơ">
            <Head title="Mục lục hồ sơ" />

            <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-[var(--text-muted)]">Dữ liệu lấy từ cơ sở dữ liệu.</p>
                <button
                    type="button"
                    onClick={onAddRow}
                    className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white"
                >
                    Thêm
                </button>
            </div>

            <div className="rounded-3xl border border-[var(--panel-border)] bg-white/90 p-6 shadow-[0_18px_40px_rgba(45,28,17,0.08)]">
                <div className="ag-theme-quartz h-[600px] overflow-hidden rounded-2xl border border-stone-200">
                    <AgGridReact
                        columnDefs={columnDefs}
                        rowData={rowData}
                        getRowId={({ data }) => String(data.id)}
                        autoSizeStrategy={{ type: 'fitCellContents' }}
                        onGridReady={(params) => {
                            gridApiRef.current = params.api;
                        }}
                        defaultColDef={{
                            sortable: true,
                            filter: true,
                            resizable: true,
                            editable: true,
                            minWidth: 100,
                            maxWidth: 560,
                        }}
                        pagination
                        paginationPageSize={10}
                        onCellValueChanged={onCellValueChanged}
                    />
                </div>
            </div>
        </AdminLayout>
    );
}
