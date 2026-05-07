import AdminLayout from '../../../Layouts/AdminLayout';
import { Head } from '@inertiajs/react';
import { AgGridReact } from 'ag-grid-react';
import { useMemo, useRef, useState } from 'react';

import 'ag-grid-community/styles/ag-theme-quartz.css';

export default function Index({ rows }) {
    const [rowData, setRowData] = useState(() => rows);
    const gridApiRef = useRef(null);

    const renderRequiredCell = () => (params) => {
        const { value, data } = params;
        if (data?.isDraft && (!value || value === '')) {
            return <span className="text-rose-600">(*)</span>;
        }
        return value ?? '';
    };

    const columnDefs = useMemo(
        () => [
            {
                headerName: '',
                field: 'select',
                maxWidth: 56,
                checkboxSelection: true,
                headerCheckboxSelection: true,
                sortable: false,
                filter: false,
            },
            { field: 'stt', headerName: 'STT', maxWidth: 90, valueGetter: 'node.rowIndex + 1' },
            {
                field: 'identifier',
                headerName: 'Mã cơ quan lưu trữ',
                maxWidth: 180,
                editable: true,
                cellRenderer: renderRequiredCell(),
            },
            {
                field: 'name',
                headerName: 'Tên cơ quan lưu trữ',
                flex: 1.6,
                editable: true,
                cellRenderer: renderRequiredCell(),
            },
            { field: 'address', headerName: 'Địa chỉ', flex: 2.2, editable: true },
            { field: 'phone', headerName: 'Số điện thoại', maxWidth: 160, editable: true },
            { field: 'email', headerName: 'Email liên hệ', flex: 1.2, editable: true },
            { field: 'manager', headerName: 'Người phụ trách', flex: 1, editable: true },
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
        [],
    );

    const isDraftReady = (row) => Boolean(row.identifier) && Boolean(row.name);

    const onCellValueChanged = async (params) => {
        const { data, colDef, newValue, oldValue } = params;

        if (newValue === oldValue) {
            return;
        }

        if (data.isDraft) {
            const updatedDraft = { ...data, [colDef.field]: newValue };

            setRowData((current) =>
                current.map((row) => (row.id === data.id ? updatedDraft : row)),
            );

            if (!isDraftReady(updatedDraft)) {
                return;
            }

            try {
                const response = await window.axios.post('/admin/archives', {
                    identifier: updatedDraft.identifier,
                    name: updatedDraft.name,
                    address: updatedDraft.address ?? '',
                    phone: updatedDraft.phone ?? '',
                    email: updatedDraft.email ?? '',
                    manager: updatedDraft.manager ?? '',
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
            await window.axios.patch(`/admin/archives/${data.id}`, {
                field: colDef.field,
                value: newValue,
            });
        } catch (error) {
            params.node.setDataValue(colDef.field, oldValue);
            alert('Update failed. Please check the value and try again.');
        }
    };

    const onAddRow = async () => {
        try {
            const minId = rowData.reduce((min, row) => Math.min(min, row.id ?? 0), 0);
            const draftId = minId <= 0 ? minId - 1 : -1;

            const draftRow = {
                id: draftId,
                identifier: '',
                name: '',
                address: '',
                phone: '',
                email: '',
                manager: '',
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
                api.startEditingCell({ rowIndex, colKey: 'identifier' });
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
            await window.axios.delete(`/admin/archives/${id}`);
            setRowData((current) => current.filter((row) => row.id !== id));
        } catch (error) {
            alert('Delete failed. Please try again.');
        }
    };

    return (
        <AdminLayout title="Cơ quan lưu trữ">
            <Head title="Cơ quan lưu trữ" />

            <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-[var(--text-muted)]">
                    Demo inline thêm/sửa/xóa trực tiếp trên bảng.
                </p>
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
                        rowSelection="multiple"
                        suppressRowClickSelection
                        pagination
                        paginationPageSize={10}
                        onCellValueChanged={onCellValueChanged}
                    />
                </div>
            </div>
        </AdminLayout>
    );
}
