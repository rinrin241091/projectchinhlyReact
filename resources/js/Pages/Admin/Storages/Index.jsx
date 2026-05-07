import AdminLayout from '../../../Layouts/AdminLayout';
import { Head } from '@inertiajs/react';
import { AgGridReact } from 'ag-grid-react';
import { useMemo, useRef, useState } from 'react';

import 'ag-grid-community/styles/ag-theme-quartz.css';

export default function Index({ rows, archivals }) {
    const [rowData, setRowData] = useState(() => rows);
    const gridApiRef = useRef(null);

    const archivalOptions = useMemo(
        () => archivals.map((archival) => ({ value: archival.id, label: archival.name })),
        [archivals],
    );
    const archivalNameById = useMemo(() => {
        const map = new Map();
        archivals.forEach((archival) => {
            map.set(archival.id, archival.name);
        });
        return map;
    }, [archivals]);

    const renderRequiredCell = () => (params) => {
        const { value, data } = params;
        if (data?.isDraft && (!value || value === '')) {
            return <span className="text-rose-600">(*)</span>;
        }
        return value ?? '';
    };

    const columnDefs = useMemo(
        () => [
            { field: 'stt', headerName: 'STT', maxWidth: 90, valueGetter: 'node.rowIndex + 1' },
            {
                field: 'code',
                headerName: 'Mã kho',
                maxWidth: 160,
                editable: true,
                cellRenderer: renderRequiredCell(),
            },
            {
                field: 'name',
                headerName: 'Tên kho',
                flex: 1.4,
                editable: true,
                cellRenderer: renderRequiredCell(),
            },
            { field: 'location', headerName: 'Mô tả vị trí', flex: 1.6, editable: true },
            {
                field: 'archival_id',
                headerName: 'Đơn vị lưu trữ',
                flex: 1.4,
                editable: true,
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: {
                    values: archivalOptions.map((option) => option.value),
                },
                cellRenderer: (params) => {
                    const { value, data } = params;
                    const display = archivalNameById.get(value) ?? '';
                    if (data?.isDraft && !display) {
                        return <span className="text-rose-600">(*)</span>;
                    }
                    return display;
                },
            },
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
        [archivalOptions, archivalNameById],
    );

    const normalizeValue = (field, value) => {
        if (field === 'archival_id') {
            if (value === null || value === undefined || value === '') {
                return null;
            }
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
        }
        return value;
    };

    const isDraftReady = (row) => Boolean(row.code) && Boolean(row.name) && Boolean(row.archival_id);

    const getNextStorageCode = (currentRows) => {
        const numericCodes = currentRows
            .map((row) => String(row.code ?? '').trim())
            .filter((code) => /^\d+$/.test(code));

        if (!numericCodes.length) {
            return '001';
        }

        const maxLen = Math.max(3, ...numericCodes.map((code) => code.length));
        const maxValue = Math.max(...numericCodes.map((code) => Number(code)));
        return String(maxValue + 1).padStart(maxLen, '0');
    };

    const onCellValueChanged = async (params) => {
        const { data, colDef, newValue, oldValue } = params;
        const editableFields = new Set(['code', 'name', 'location', 'archival_id']);
        if (!editableFields.has(colDef.field)) {
            return;
        }

        if (newValue === oldValue) {
            return;
        }

        const normalizedValue = normalizeValue(colDef.field, newValue);

        if (data.isDraft) {
            const updatedDraft = { ...data, [colDef.field]: normalizedValue };

            setRowData((current) =>
                current.map((row) => (row.id === data.id ? updatedDraft : row)),
            );

            if (!isDraftReady(updatedDraft)) {
                return;
            }

            try {
                const response = await window.axios.post('/admin/storages', {
                    code: updatedDraft.code,
                    name: updatedDraft.name,
                    location: updatedDraft.location ?? '',
                    archival_id: updatedDraft.archival_id,
                });
                setRowData((current) =>
                    current.map((row) => (row.id === data.id ? response.data : row)),
                );
            } catch (error) {
                const message =
                    error?.response?.data?.message ||
                    Object.values(error?.response?.data?.errors ?? {})
                        .flat()
                        .join('\n') ||
                    'Create failed. Please try again.';
                alert(message);
                setTimeout(() => {
                    params.api.startEditingCell({
                        rowIndex: params.node.rowIndex,
                        colKey: 'code',
                    });
                }, 0);
            }
            return;
        }

        try {
            await window.axios.patch(`/admin/storages/${data.id}`, {
                field: colDef.field,
                value: normalizedValue,
            });
        } catch (error) {
            params.node.setDataValue(colDef.field, oldValue);
            const message =
                error?.response?.data?.message ||
                Object.values(error?.response?.data?.errors ?? {})
                    .flat()
                    .join('\n') ||
                'Update failed. Please check the value and try again.';
            alert(message);
        }
    };

    const onAddRow = async () => {
        try {
            const firstArchival = archivals[0];
            if (!firstArchival) {
                alert('Vui lòng tạo "Cơ quan lưu trữ" trước.');
                return;
            }

            const minId = rowData.reduce((min, row) => Math.min(min, row.id ?? 0), 0);
            const draftId = minId <= 0 ? minId - 1 : -1;

            const draftRow = {
                id: draftId,
                code: getNextStorageCode(rowData),
                name: '',
                location: '',
                archival_id: Number(firstArchival.id),
                created_at: null,
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
                api.startEditingCell({ rowIndex, colKey: 'code' });
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
            await window.axios.delete(`/admin/storages/${id}`);
            setRowData((current) => current.filter((row) => row.id !== id));
        } catch (error) {
            alert('Delete failed. Please try again.');
        }
    };

    return (
        <AdminLayout title="Kho lưu trữ">
            <Head title="Kho lưu trữ" />

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
                            editable: false,
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
