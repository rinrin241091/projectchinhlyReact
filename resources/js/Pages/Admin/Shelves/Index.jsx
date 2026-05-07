import AdminLayout from '../../../Layouts/AdminLayout';
import { Head } from '@inertiajs/react';
import { AgGridReact } from 'ag-grid-react';
import { useMemo, useRef, useState } from 'react';

import 'ag-grid-community/styles/ag-theme-quartz.css';

export default function Index({ rows, storages }) {
    const [rowData, setRowData] = useState(() => rows);
    const gridApiRef = useRef(null);

    const storageOptions = useMemo(
        () =>
            storages.map((storage) => ({
                value: storage.id,
                label: storage.name,
            })),
        [storages],
    );

    const storageNameById = useMemo(() => {
        const map = new Map();
        storages.forEach((storage) => {
            map.set(storage.id, storage.name);
        });
        return map;
    }, [storages]);

    const archivalNameByStorageId = useMemo(() => {
        const map = new Map();
        storages.forEach((storage) => {
            map.set(storage.id, storage.archival_name ?? '');
        });
        return map;
    }, [storages]);

    const columnDefs = useMemo(
        () => [
            { field: 'stt', headerName: 'STT', maxWidth: 90, valueGetter: 'node.rowIndex + 1' },
            { field: 'code', headerName: 'Mã kệ', maxWidth: 160, editable: true },
            { field: 'description', headerName: 'Mô tả', flex: 1.6, editable: true },
            {
                field: 'storage_id',
                headerName: 'Thuộc kho',
                flex: 1.4,
                editable: true,
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: {
                    values: storageOptions.map((option) => option.value),
                },
                valueFormatter: ({ value }) => storageNameById.get(value) ?? '',
            },
            {
                field: 'archival_name',
                headerName: 'Cơ quan lưu trữ',
                flex: 1.4,
                valueGetter: ({ data }) =>
                    data?.storage_id ? archivalNameByStorageId.get(data.storage_id) ?? '' : '',
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
        [storageOptions, storageNameById, archivalNameByStorageId],
    );

    const normalizeValue = (field, value) => {
        if (field === 'storage_id') {
            if (value === null || value === undefined || value === '') {
                return null;
            }
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
        }
        return value;
    };

    const isDraftReady = (row) => Boolean(row.code) && Boolean(row.storage_id);

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

            if (colDef.field === 'storage_id') {
                params.api.refreshCells({
                    rowNodes: [params.node],
                    columns: ['archival_name'],
                    force: true,
                });
            }

            if (!isDraftReady(updatedDraft)) {
                return;
            }

            try {
                const response = await window.axios.post('/admin/shelves', {
                    code: updatedDraft.code,
                    description: updatedDraft.description ?? '',
                    storage_id: updatedDraft.storage_id,
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
            await window.axios.patch(`/admin/shelves/${data.id}`, {
                field: colDef.field,
                value: normalizedValue,
            });
            if (colDef.field === 'storage_id') {
                params.api.refreshCells({
                    rowNodes: [params.node],
                    columns: ['archival_name'],
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
            const firstStorage = storages[0];
            if (!firstStorage) {
                alert('Vui lòng tạo "Kho lưu trữ" trước.');
                return;
            }

            const minId = rowData.reduce((min, row) => Math.min(min, row.id ?? 0), 0);
            const draftId = minId <= 0 ? minId - 1 : -1;

            const draftRow = {
                id: draftId,
                code: '',
                description: '',
                storage_id: null,
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
            await window.axios.delete(`/admin/shelves/${id}`);
            setRowData((current) => current.filter((row) => row.id !== id));
        } catch (error) {
            alert('Delete failed. Please try again.');
        }
    };

    return (
        <AdminLayout title="Danh sách kệ">
            <Head title="Danh sách kệ" />

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
