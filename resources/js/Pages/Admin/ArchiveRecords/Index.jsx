import AdminLayout from '../../../Layouts/AdminLayout';
import { Head, usePage } from '@inertiajs/react';
import { AgGridReact } from 'ag-grid-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import 'ag-grid-community/styles/ag-theme-quartz.css';

export default function Index({ rows, boxes, items, organizationType, selectedOrganizationCode }) {
    const page = usePage();
    const currentUser = page.props?.auth?.user;
    const [rowData, setRowData] = useState(() => rows);
    const [selectedItemFilter, setSelectedItemFilter] = useState(() =>
        items?.[0]?.id ? String(items[0].id) : '',
    );
    const gridApiRef = useRef(null);

    const formatDate = (value) => {
        if (!value) {
            return '';
        }
        if (value instanceof Date) {
            const year = value.getFullYear();
            const month = `${value.getMonth() + 1}`.padStart(2, '0');
            const day = `${value.getDate()}`.padStart(2, '0');
            return `${day}/${month}/${year}`;
        }
        if (typeof value !== 'string') {
            return '';
        }
        if (value.includes('-')) {
            const [year, month, day] = value.split('-');
            if (year && month && day) {
                return `${day}/${month}/${year}`;
            }
        }
        return value;
    };

    const parseDateInput = (value) => {
        if (!value) {
            return null;
        }
        if (value instanceof Date) {
            const year = value.getFullYear();
            const month = `${value.getMonth() + 1}`.padStart(2, '0');
            const day = `${value.getDate()}`.padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        if (typeof value !== 'string') {
            return value;
        }
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        if (trimmed.includes('/')) {
            const [day, month, year] = trimmed.split('/');
            if (day && month && year && /^\d+$/.test(day) && /^\d+$/.test(month) && /^\d+$/.test(year)) {
                return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
            return null;
        }
        return trimmed;
    };

    const boxOptions = useMemo(
        () => boxes.map((box) => ({ value: box.id, label: box.code })),
        [boxes],
    );

    const boxCodeById = useMemo(() => {
        const map = new Map();
        boxes.forEach((box) => {
            map.set(box.id, box.code);
        });
        return map;
    }, [boxes]);

    const itemOptions = useMemo(
        () =>
            items.map((item) => ({
                value: item.id,
                label: `${item.archive_record_item_code} - ${item.title ?? ''}`.trim(),
            })),
        [items],
    );

    useEffect(() => {
        if (!items?.length) {
            setSelectedItemFilter('');
            return;
        }
        const exists = items.some((item) => String(item.id) === String(selectedItemFilter));
        if (!exists) {
            setSelectedItemFilter(String(items[0].id));
        }
    }, [items, selectedItemFilter]);

    const itemCodeById = useMemo(() => {
        const map = new Map();
        items.forEach((item) => {
            map.set(item.id, item.archive_record_item_code);
        });
        return map;
    }, [items]);
    const itemTitleById = useMemo(() => {
        const map = new Map();
        items.forEach((item) => {
            map.set(item.id, item.title ?? '');
        });
        return map;
    }, [items]);
    const itemDescriptionById = useMemo(() => {
        const map = new Map();
        items.forEach((item) => {
            map.set(item.id, item.description ?? '');
        });
        return map;
    }, [items]);
    const itemIdByTitle = useMemo(() => {
        const map = new Map();
        items.forEach((item) => {
            map.set((item.title ?? '').trim(), item.id);
        });
        return map;
    }, [items]);

    const itemOrgCodeById = useMemo(() => {
        const map = new Map();
        items.forEach((item) => {
            map.set(item.id, item.organization_code ?? '');
        });
        return map;
    }, [items]);

    const normalizePlainText = (value) =>
        String(value ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();

    const shouldDefaultPermanent = (itemId) => {
        const note = itemDescriptionById.get(Number(itemId)) ?? '';
        const normalized = normalizePlainText(note);
        return normalized === 'vinh vien' || normalized.includes('vinh vien');
    };

    const isDang = organizationType === 'Đảng';
    const normalizedRole = String(currentUser?.role ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\s-]+/g, '_');
    const isAdmin = normalizedRole === 'admin';
    const statusOptions = ['da_nhap', 'dang_nhap', 'chua_nhap'];

    const resolveStatusCode = (row) => {
        if (String(row?.status ?? '').trim() === 'da_nhap') {
            return 'da_nhap';
        }
        return Number(row?.documents_count ?? 0) > 0 ? 'dang_nhap' : 'chua_nhap';
    };

    const statusLabel = (statusCode) => {
        if (statusCode === 'da_nhap') return 'Đã nhập';
        if (statusCode === 'dang_nhap') return 'Đang nhập';
        return 'Chưa nhập';
    };

    const normalizeStatusText = (value) =>
        normalizePlainText(value)
            .replace(/[_\s]+/g, ' ')
            .trim();

    const matchesStatusValue = (value, expectedStatusCode) =>
        normalizeStatusText(value) === String(expectedStatusCode ?? '').replace(/_/g, ' ');

    const statusBadgeClass = (statusCode) => {
        if (statusCode === 'da_nhap') {
            return 'bg-emerald-100 text-emerald-800';
        }
        if (statusCode === 'dang_nhap') {
            return 'bg-amber-100 text-amber-800';
        }
        return 'bg-rose-100 text-rose-700';
    };

    const getArchiveRecordNumber = (row) => {
        const directCode = String(row?.code ?? '').trim();
        if (directCode) {
            return directCode;
        }

        const ref = String(row?.reference_code ?? '').trim();
        if (!ref) {
            return '';
        }

        const parts = ref
            .split('-')
            .map((part) => part.trim())
            .filter(Boolean);

        return parts.length > 0 ? parts[parts.length - 1] : ref;
    };

    const filteredRowData = useMemo(() => {
        if (!selectedItemFilter) {
            return rowData;
        }
        const selectedId = Number(selectedItemFilter);
        return rowData.filter((row) => Number(row.archive_record_item_id) === selectedId);
    }, [rowData, selectedItemFilter]);

    const columnDefs = useMemo(() => {
        const actionColumn = {
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
        };
        const statusColumn = {
            field: 'status',
            headerName: 'Trạng thái',
            maxWidth: 150,
            editable: isAdmin,
            filter: 'agTextColumnFilter',
            filterValueGetter: ({ data }) => statusLabel(resolveStatusCode(data)),
            filterParams: {
                suppressAndOrCondition: true,
                maxNumConditions: 1,
                filterOptions: [
                    {
                        displayKey: 'da_nhap',
                        displayName: 'Đã nhập',
                        numberOfInputs: 0,
                        predicate: (_, cellValue) => matchesStatusValue(cellValue, 'da_nhap'),
                    },
                    {
                        displayKey: 'dang_nhap',
                        displayName: 'Đang nhập',
                        numberOfInputs: 0,
                        predicate: (_, cellValue) => matchesStatusValue(cellValue, 'dang_nhap'),
                    },
                    {
                        displayKey: 'chua_nhap',
                        displayName: 'Chưa nhập',
                        numberOfInputs: 0,
                        predicate: (_, cellValue) => matchesStatusValue(cellValue, 'chua_nhap'),
                    },
                ],
            },
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: {
                values: statusOptions,
            },
            valueGetter: ({ data }) => resolveStatusCode(data),
            valueFormatter: ({ value }) => statusLabel(value),
            cellRenderer: ({ data, value }) => {
                const statusCode = value ?? resolveStatusCode(data);
                return (
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(statusCode)}`}>
                        {statusLabel(statusCode)}
                    </span>
                );
            },
        };

        if (isDang) {
            return [
                { field: 'stt', headerName: 'STT', maxWidth: 110, editable: false, valueGetter: 'node.rowIndex + 1' },
                {
                    field: 'organization_code_display',
                    headerName: 'Phông số',
                    maxWidth: 120,
                    editable: false,
                    valueGetter: ({ data }) =>
                        itemOrgCodeById.get(data?.archive_record_item_id) ??
                        data?.organization_code_display ??
                        selectedOrganizationCode ??
                        '',
                },
                {
                    field: 'box_id',
                    headerName: 'Số cặp (hộp)',
                    maxWidth: 140,
                    editable: true,
                    cellEditor: 'agSelectCellEditor',
                    cellEditorParams: {
                        values: boxOptions.map((option) => option.value),
                    },
                    valueFormatter: ({ value }) => boxCodeById.get(value) ?? '',
                },
                {
                    field: 'archive_record_item_id',
                    headerName: 'Mục lục số',
                    maxWidth: 130,
                    editable: true,
                    cellEditor: 'agSelectCellEditor',
                    cellEditorParams: {
                        values: itemOptions.map((option) => option.value),
                    },
                    valueFormatter: ({ value }) => itemCodeById.get(value) ?? '',
                },
                {
                    field: 'reference_code',
                    headerName: 'Hồ sơ số',
                    maxWidth: 120,
                    editable: true,
                    valueFormatter: ({ data }) => getArchiveRecordNumber(data),
                },
                { field: 'title', headerName: 'Tên hồ sơ', flex: 1.2, editable: true },
                { field: 'keywords', headerName: 'Từ khóa', maxWidth: 140, editable: false },
                { field: 'description', headerName: 'Chú giải', maxWidth: 170, editable: true },
                {
                    field: 'time_range',
                    headerName: 'Thời gian bắt đầu và kết thúc',
                    maxWidth: 230,
                    editable: false,
                    wrapText: true,
                    autoHeight: true,
                    cellStyle: {
                        whiteSpace: 'pre-line',
                        lineHeight: '1.35',
                        paddingTop: '6px',
                        paddingBottom: '6px',
                    },
                    valueGetter: ({ data }) =>
                        `${formatDate(data?.start_date)}\n${formatDate(data?.end_date)}`,
                },
                { field: 'preservation_duration', headerName: 'Thời hạn bảo quản', maxWidth: 170, editable: true },
                { field: 'page_count', headerName: 'Số trang', maxWidth: 110, editable: false },
                { field: 'documents_count', headerName: 'Số tài liệu', maxWidth: 120, editable: false },
                { field: 'security_level', headerName: 'Độ mật', maxWidth: 120, editable: false },
                ...(isAdmin ? [statusColumn] : []),
                { field: 'note', headerName: 'Ghi chú', flex: 1, editable: true },
                actionColumn,
            ];
        }

        return [
            { field: 'stt', headerName: 'STT', maxWidth: 90, valueGetter: 'node.rowIndex + 1' },
            {
                field: 'box_id',
                headerName: 'Hộp số',
                maxWidth: 140,
                editable: true,
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: {
                    values: boxOptions.map((option) => option.value),
                },
                valueFormatter: ({ value }) => boxCodeById.get(value) ?? '',
            },
            {
                field: 'reference_code',
                headerName: 'Hồ sơ số',
                maxWidth: 160,
                editable: true,
                valueFormatter: ({ data }) => getArchiveRecordNumber(data),
            },
            { field: 'title', headerName: 'Tiêu đề hồ sơ', flex: 1.6, editable: true },
            {
                field: 'start_date',
                headerName: 'Bắt đầu',
                maxWidth: 140,
                editable: true,
                cellEditor: 'agDateCellEditor',
                cellEditorParams: {
                    useBrowserDatePicker: true,
                },
                valueFormatter: ({ value }) => formatDate(value),
                valueParser: ({ newValue }) => parseDateInput(newValue),
            },
            {
                field: 'end_date',
                headerName: 'Kết thúc',
                maxWidth: 140,
                editable: true,
                cellEditor: 'agDateCellEditor',
                cellEditorParams: {
                    useBrowserDatePicker: true,
                },
                valueFormatter: ({ value }) => formatDate(value),
                valueParser: ({ newValue }) => parseDateInput(newValue),
            },
            { field: 'preservation_duration', headerName: 'Thời hạn bảo quản', maxWidth: 170, editable: true },
            { field: 'page_count', headerName: 'Số lượng tờ', maxWidth: 140, editable: true },
            {
                field: 'archive_record_item_id',
                headerName: 'Mục lục',
                flex: 1,
                editable: true,
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: {
                    values: itemOptions.map((option) => option.label),
                },
                valueFormatter: ({ value }) => itemTitleById.get(Number(value)) ?? '',
            },
            { field: 'note', headerName: 'Ghi chú', flex: 1.2, editable: true },
            actionColumn,
        ];
    }, [boxOptions, boxCodeById, itemOptions, itemCodeById, itemTitleById, itemOrgCodeById, isDang, isAdmin, selectedOrganizationCode]);

    const adjustedColumnDefs = useMemo(
        () =>
            columnDefs.map((col) =>
                col.field === 'reference_code'
                    ? {
                          ...col,
                          minWidth: isDang ? 140 : 160,
                          maxWidth: 420,
                          resizable: true,
                      }
                    : col,
            ),
        [columnDefs, isDang],
    );

    const normalizeValue = (field, value) => {
        if (field === 'box_id') {
            if (value === null || value === undefined || value === '') {
                return null;
            }
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
        }
        if (field === 'archive_record_item_id') {
            if (value === null || value === undefined || value === '') {
                return null;
            }
            if (!isDang && typeof value === 'string') {
                const titleOnly = value.includes(' - ') ? value.split(' - ').slice(1).join(' - ').trim() : value.trim();
                if (itemIdByTitle.has(titleOnly)) {
                    return Number(itemIdByTitle.get(titleOnly));
                }
            }
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
        }
        if (field === 'page_count') {
            if (value === null || value === undefined || value === '') {
                return null;
            }
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
        }
        if (field === 'start_date' || field === 'end_date') {
            return parseDateInput(value);
        }
        if (field === 'status') {
            return String(value ?? '').trim() === 'da_nhap' ? 'da_nhap' : null;
        }
        return value;
    };

    const isDraftReady = (row) => Boolean(row.reference_code) && Boolean(row.title);

    const onCellValueChanged = async (params) => {
        const { data, colDef, newValue, oldValue } = params;

        if (newValue === oldValue) {
            return;
        }

        const normalizedValue = normalizeValue(colDef.field, newValue);

        if (data.isDraft) {
            const updatedDraft = { ...data, [colDef.field]: normalizedValue };

            if (
                colDef.field === 'archive_record_item_id' &&
                !String(updatedDraft.preservation_duration ?? '').trim()
            ) {
                updatedDraft.preservation_duration = shouldDefaultPermanent(normalizedValue)
                    ? 'Vĩnh viễn'
                    : '';
            }

            setRowData((current) => current.map((row) => (row.id === data.id ? updatedDraft : row)));

            if (!isDraftReady(updatedDraft)) {
                return;
            }

            try {
                const response = await window.axios.post('/admin/archive-records', {
                    reference_code: updatedDraft.reference_code,
                    title: updatedDraft.title,
                    description: updatedDraft.description ?? '',
                    start_date: updatedDraft.start_date ?? null,
                    end_date: updatedDraft.end_date ?? null,
                    preservation_duration: updatedDraft.preservation_duration ?? '',
                    page_count: updatedDraft.page_count ?? null,
                    archive_record_item_id: updatedDraft.archive_record_item_id ?? null,
                    note: updatedDraft.note ?? '',
                    box_id: updatedDraft.box_id ?? null,
                    status: normalizeValue('status', updatedDraft.status),
                });
                setRowData((current) => current.map((row) => (row.id === data.id ? response.data : row)));
            } catch (error) {
                const message =
                    error?.response?.data?.message ||
                    Object.values(error?.response?.data?.errors ?? {})
                        .flat()
                        .join('\n') ||
                    'Create failed. Please try again.';
                alert(message);
            }
            return;
        }

        try {
            const response = await window.axios.patch(`/admin/archive-records/${data.id}`, {
                field: colDef.field,
                value: normalizedValue,
            });

            if (colDef.field === 'status') {
                setRowData((current) =>
                    current.map((row) =>
                        row.id === data.id
                            ? {
                                  ...row,
                                  status: response?.data?.status ?? (normalizedValue === 'da_nhap' ? 'da_nhap' : null),
                                  status_label: response?.data?.status_label ?? undefined,
                              }
                            : row,
                    ),
                );
            }
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
        if (!selectedItemFilter) {
            alert('Vui lòng chọn mục lục hồ sơ trước.');
            return;
        }

        const minId = rowData.reduce((min, row) => Math.min(min, row.id ?? 0), 0);
        const draftId = minId <= 0 ? minId - 1 : -1;

        const draftRow = {
            id: draftId,
            box_id: null,
            reference_code: '',
            title: '',
            description: '',
            start_date: null,
            end_date: null,
            preservation_duration: shouldDefaultPermanent(Number(selectedItemFilter))
                ? 'Vĩnh viễn'
                : '',
            page_count: null,
            archive_record_item_id: Number(selectedItemFilter),
            note: '',
            documents_count: 0,
            keywords: '',
            security_level: '',
            status: 'chua_nhap',
            status_label: 'Chưa nhập',
            organization_code_display: selectedOrganizationCode ?? '',
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
            api.startEditingCell({ rowIndex, colKey: 'reference_code' });
        }, 0);
    };

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key !== 'F2' || event.repeat) {
                return;
            }
            if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
                return;
            }
            event.preventDefault();
            onAddRow();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onAddRow]);

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
            await window.axios.delete(`/admin/archive-records/${id}`);
            setRowData((current) => current.filter((rowItem) => rowItem.id !== id));
        } catch (error) {
            alert('Delete failed. Please try again.');
        }
    };

    const onExportExcel = () => {
        const query = selectedItemFilter
            ? `?archive_record_item_id=${encodeURIComponent(String(selectedItemFilter))}`
            : '';
        window.location.href = `/admin/archive-records/export${query}`;
    };

    return (
        <AdminLayout title="Hồ sơ lưu trữ">
            <Head title="Hồ sơ lưu trữ" />

            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-sm text-[var(--text-muted)]">Mục lục hồ sơ</span>
                    <select
                        value={selectedItemFilter}
                        onChange={(event) => setSelectedItemFilter(event.target.value)}
                        className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-[var(--text-main)]"
                    >
                        {itemOptions.length === 0 && <option value="">Không có mục lục</option>}
                        {itemOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onExportExcel}
                        className="rounded-full border border-stone-300 bg-white px-5 py-2 text-sm font-semibold text-[var(--text-main)]"
                    >
                        Xuất Excel
                    </button>
                    <button
                        type="button"
                        onClick={onAddRow}
                        title="Phím tắt F2"
                        className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white"
                    >
                        Thêm
                    </button>
                </div>
            </div>

            <div className="rounded-3xl border border-[var(--panel-border)] bg-white/90 p-6 shadow-[0_18px_40px_rgba(45,28,17,0.08)]">
                <div className="ag-theme-quartz h-[600px] overflow-hidden rounded-2xl border border-stone-200">
                    <AgGridReact
                        columnDefs={adjustedColumnDefs}
                        rowData={filteredRowData}
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
