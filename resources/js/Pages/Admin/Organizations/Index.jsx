import AdminLayout from '../../../Layouts/AdminLayout';
import { Head } from '@inertiajs/react';
import { AgGridReact } from 'ag-grid-react';
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';

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

    const ArchivalSelectEditor = useMemo(
        () =>
            forwardRef((props, ref) => {
                const options = props.options ?? [];
                const initialValue = props.value ?? '';
                const [value, setValue] = useState(initialValue);
                const valueRef = useRef(initialValue);

                useImperativeHandle(ref, () => ({
                    getValue: () => (valueRef.current === '' ? null : Number(valueRef.current)),
                }));

                return (
                    <select
                        className="h-full w-full bg-transparent px-2 text-sm"
                        value={value ?? ''}
                        onChange={(event) => {
                            const nextValue = event.target.value;
                            valueRef.current = nextValue;
                            setValue(nextValue);
                            props.node.setDataValue('archival_id', nextValue === '' ? null : Number(nextValue));
                            if (props.api?.stopEditing) {
                                props.api.stopEditing();
                            } else if (props.stopEditing) {
                                props.stopEditing();
                            }
                        }}
                        autoFocus
                    >
                        <option value="">--</option>
                        {options.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                );
            }),
        [],
    );

    const renderRequiredCell = () => (params) => {
        const { value, data } = params;
        if (data?.isDraft && (!value || value === '')) {
            return <span className="text-rose-600">(*)</span>;
        }
        return value ?? '';
    };

    const columnDefs = useMemo(
        () => [
            { field: 'id', headerName: 'Id', maxWidth: 90 },
            {
                field: 'code',
                headerName: 'Mã phông',
                maxWidth: 150,
                editable: true,
                cellRenderer: renderRequiredCell(),
            },
            {
                field: 'name',
                headerName: 'Tên phông',
                flex: 1.5,
                editable: true,
                cellRenderer: renderRequiredCell(),
            },
            {
                field: 'type',
                headerName: 'Loại phông',
                maxWidth: 150,
                editable: true,
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: {
                    values: ['Đảng', 'Chính quyền'],
                },
            },
            {
                field: 'archival_id',
                headerName: 'Tên cơ quan lưu trữ',
                flex: 1.3,
                editable: true,
                cellEditor: 'archivalSelectEditor',
                cellEditorParams: {
                    options: archivalOptions,
                },
                valueParser: ({ newValue }) => (newValue === '' || newValue === null ? null : Number(newValue)),
                valueSetter: (params) => {
                    const nextValue =
                        params.newValue === '' || params.newValue === null ? null : Number(params.newValue);
                    if (params.data.archival_id === nextValue) {
                        return false;
                    }
                    params.data.archival_id = nextValue;
                    return true;
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
                field: 'archivals_time',
                headerName: 'Thời gian hồ sơ',
                maxWidth: 160,
                editable: true,
            },
            {
                field: 'created_at',
                headerName: 'Ngày tạo',
                maxWidth: 200,
                valueFormatter: ({ value }) => (value ? new Date(value).toLocaleString() : ''),
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

    const isDraftReady = (row) =>
        Boolean(row.code) && Boolean(row.name) && Boolean(row.archivals_time) && Boolean(row.archival_id);

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

            if (!isDraftReady(updatedDraft)) {
                return;
            }

            try {
                const response = await window.axios.post('/admin/organizations', {
                    code: updatedDraft.code,
                    name: updatedDraft.name,
                    type: updatedDraft.type ?? '',
                    archivals_time: updatedDraft.archivals_time,
                    key_groups: updatedDraft.key_groups ?? '',
                    archival_id: updatedDraft.archival_id,
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
            await window.axios.patch(`/admin/organizations/${data.id}`, {
                field: colDef.field,
                value: normalizedValue,
            });
        } catch (error) {
            params.node.setDataValue(colDef.field, oldValue);
            alert('Update failed. Please check the value and try again.');
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
                code: '',
                name: '',
                type: '',
                archivals_time: '',
                key_groups: '',
                archival_id: null,
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
            await window.axios.delete(`/admin/organizations/${id}`);
            setRowData((current) => current.filter((item) => item.id !== id));
        } catch (error) {
            alert('Delete failed. Please try again.');
        }
    };

    return (
        <AdminLayout title="Phông lưu trữ">
            <Head title="Phông lưu trữ" />

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
                        components={{
                            archivalSelectEditor: ArchivalSelectEditor,
                        }}
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


