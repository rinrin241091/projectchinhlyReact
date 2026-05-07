import AdminLayout from '../../../Layouts/AdminLayout';
import { Head } from '@inertiajs/react';
import { AgGridReact } from 'ag-grid-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import 'ag-grid-community/styles/ag-theme-quartz.css';

export default function Index({ items }) {
    const [expandedIds, setExpandedIds] = useState(new Set());
    const gridApiRef = useRef(null);
    const anchorRowIdRef = useRef(null);

    const rowData = useMemo(
        () => buildVisible(items, expandedIds),
        [items, expandedIds],
    );

    const toggleExpand = useCallback((id) => {
        anchorRowIdRef.current = id;
        setExpandedIds((current) => {
            const next = new Set(current);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    useEffect(() => {
        const anchorRowId = anchorRowIdRef.current;
        const api = gridApiRef.current;

        if (!anchorRowId || !api) {
            return;
        }

        requestAnimationFrame(() => {
            let rowIndex = null;
            api.forEachNode((node) => {
                if (rowIndex !== null) {
                    return;
                }
                if (String(node?.data?.id) === String(anchorRowId)) {
                    rowIndex = node.rowIndex;
                }
            });

            if (rowIndex !== null && rowIndex >= 0) {
                api.ensureIndexVisible(rowIndex, 'middle');
                api.setFocusedCell(rowIndex, 'title');
            }

            anchorRowIdRef.current = null;
        });
    }, [rowData]);

    const columnDefs = useMemo(
        () => [
            {
                headerName: '',
                field: 'toggle',
                maxWidth: 80,
                sortable: false,
                filter: false,
                cellRenderer: (params) => {
                    const { data } = params;
                    if (!data?.hasChildren) {
                        return null;
                    }
                    const isOpen = expandedIds.has(data.id);
                    return (
                        <button
                            type="button"
                            onClick={() => toggleExpand(data.id)}
                            className="rounded-full border border-stone-200 px-3 py-1 text-xs font-semibold"
                        >
                            {isOpen ? '-' : '+'}
                        </button>
                    );
                },
            },
            {
                field: 'total_records',
                headerName: 'Tổng số hồ sơ',
                maxWidth: 170,
                cellClass: 'text-center',
                cellDataType: false,
                valueFormatter: (params) =>
                    params.value === null || params.value === undefined || params.value === ''
                        ? ''
                        : String(params.value),
            },
            {
                field: 'title',
                headerName: 'Tên phông',
                flex: 2.6,
                cellRenderer: (params) => (
                    <div style={{ paddingLeft: `${params.data?.depth * 16}px` }}>
                        <span className="text-sm font-semibold text-[var(--text-main)]">{params.value}</span>
                    </div>
                ),
            },
            { field: 'pages', headerName: 'Số trang', maxWidth: 140, cellClass: 'text-center' },
            { field: 'document_count', headerName: 'Số tài liệu', maxWidth: 140, cellClass: 'text-center' },
        ],
        [expandedIds, toggleExpand],
    );

    return (
        <AdminLayout title="Danh mục tổng quan">
            <Head title="Danh mục tổng quan" />

            <div className="rounded-3xl border border-[var(--panel-border)] bg-white/90 p-6 shadow-[0_18px_40px_rgba(45,28,17,0.08)]">
                <div className="ag-theme-quartz h-[calc(100vh-170px)] min-h-[720px] overflow-hidden rounded-2xl border border-stone-200">
                    <AgGridReact
                        columnDefs={columnDefs}
                        rowData={rowData}
                        getRowId={({ data }) => String(data.id)}
                        onGridReady={(params) => {
                            gridApiRef.current = params.api;
                        }}
                        autoSizeStrategy={{ type: 'fitCellContents' }}
                        suppressScrollOnNewData
                        defaultColDef={{
                            sortable: false,
                            filter: false,
                            resizable: true,
                            minWidth: 100,
                            maxWidth: 560,
                        }}
                    />
                </div>
            </div>
        </AdminLayout>
    );
}

function buildVisible(items, expandedIds, depth = 0, parentId = null) {
    const rows = [];
    items.forEach((item) => {
        const row = {
            id: item.id,
            title: item.title,
            total_records: item.total_records ?? '',
            pages: item.pages ?? '',
            document_count: item.document_count ?? '',
            depth,
            parentId,
            hasChildren: Boolean(item.children && item.children.length),
        };
        rows.push(row);
        if (item.children && item.children.length && expandedIds.has(item.id)) {
            rows.push(...buildVisible(item.children, expandedIds, depth + 1, item.id));
        }
    });
    return rows;
}
