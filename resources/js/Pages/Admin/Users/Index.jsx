import AdminLayout from '../../../Layouts/AdminLayout';
import { Head, Link, router } from '@inertiajs/react';
import { AgGridReact } from 'ag-grid-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import 'ag-grid-community/styles/ag-theme-quartz.css';

export default function Index({ users }) {
    const gridRef = useRef(null);
    const [userRows, setUserRows] = useState(() => users);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [expandedIds, setExpandedIds] = useState(new Set());
    const roleOptions = useMemo(() => ['admin', 'user', 'nhap_lieu'], []);
    const roleLabel = (role) => {
        const normalizedRole = String(role ?? '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[\s-]+/g, '_');

        if (normalizedRole === 'admin') {
            return 'Admin';
        }
        if (normalizedRole === 'nhap_lieu') {
            return 'Nhập liệu';
        }
        return 'User';
    };
    const onlineLabel = (isOnline) => (isOnline ? 'Online' : 'Offline');
    const formatLastSeen = (value) => {
        if (!value) {
            return '-';
        }

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return '-';
        }

        return new Intl.DateTimeFormat('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    };

    useEffect(() => {
        setUserRows(users);
    }, [users]);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.axios) {
            return undefined;
        }

        const loadPresence = async () => {
            try {
                const response = await window.axios.get('/admin/users/presence');
                const presenceMap = new Map(
                    (response?.data?.users ?? []).map((row) => [Number(row.id), row]),
                );

                setUserRows((current) =>
                    current.map((user) => {
                        const presence = presenceMap.get(Number(user.id));
                        return presence
                            ? {
                                  ...user,
                                  last_seen_at: presence.last_seen_at,
                                  is_online: Boolean(presence.is_online),
                              }
                            : user;
                    }),
                );
            } catch {
                // ignore transient polling errors
            }
        };

        loadPresence();
        const intervalId = window.setInterval(loadPresence, 15000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, []);

    const totals = useMemo(() => {
        const total = userRows.length;
        const admins = userRows.filter((user) => user.role === 'admin').length;
        const verified = userRows.filter((user) => Boolean(user.email_verified_at)).length;
        const online = userRows.filter((user) => Boolean(user.is_online)).length;

        return { total, admins, verified, online };
    }, [userRows]);


    const toggleExpand = useCallback((id) => {
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

    const columnDefs = useMemo(
        () => [
            {
                headerName: '',
                field: 'expand',
                maxWidth: 80,
                sortable: false,
                filter: false,
                cellRenderer: ({ data }) => {
                    if (data.rowType !== 'data') {
                        return <DetailPanel data={data} />;
                    }

                    const isOpen = expandedIds.has(data.id);
                    return (
                        <button
                            type="button"
                            onClick={() => toggleExpand(data.id)}
                            className="rounded-full border border-stone-200 px-3 py-1 text-xs font-semibold"
                        >
                            {isOpen ? 'Hide' : 'Show'}
                        </button>
                    );
                },
                colSpan: (params) => {
                    if (params.data?.__detail) {
                        return params.api.getAllDisplayedColumns().length;
                    }
                    return 1;
                },
            },
            { field: 'id', headerName: '#', maxWidth: 90 },
            {
                field: 'name',
                headerName: 'User',
                flex: 1.4,
                editable: true,
                cellRenderer: ({ data }) => (
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100 text-sm font-semibold text-[var(--text-main)]">
                            {(data.name || '?').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span
                                    className={`h-2.5 w-2.5 rounded-full ${
                                        data?.is_online ? 'bg-emerald-500' : 'bg-stone-400'
                                    }`}
                                />
                                <div className="text-sm font-semibold text-[var(--text-main)]">{data.name}</div>
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">{data.email}</div>
                        </div>
                    </div>
                ),
            },
            {
                field: 'email',
                headerName: 'Email',
                flex: 1.4,
                editable: true,
            },
            {
                field: 'role',
                flex: 0.7,
                editable: true,
                cellRenderer: ({ value }) => (
                    <div className="flex items-center gap-3">
                        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-[var(--text-main)]">
                            {roleLabel(value)}
                        </span>
                    </div>
                ),
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: { values: roleOptions },
            },
            {
                headerName: 'Status',
                field: 'is_online',
                flex: 0.7,
                editable: false,
                sortable: true,
                filter: 'agTextColumnFilter',
                valueGetter: ({ data }) => onlineLabel(Boolean(data?.is_online)),
                filterValueGetter: ({ data }) => onlineLabel(Boolean(data?.is_online)),
                filterParams: {
                    filterOptions: ['equals'],
                    defaultOption: 'equals',
                    buttons: ['reset', 'apply'],
                    debounceMs: 0,
                },
                comparator: (valueA, valueB) => {
                    const rank = { Online: 0, Offline: 1 };
                    return (rank[valueA] ?? 99) - (rank[valueB] ?? 99);
                },
                cellRenderer: ({ data }) => (
                    <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            data?.is_online ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'
                        }`}
                    >
                        {onlineLabel(Boolean(data?.is_online))}
                    </span>
                ),
            },
            {
                headerName: 'Lần cuối hoạt động',
                field: 'last_seen_at',
                flex: 1,
                minWidth: 180,
                editable: false,
                sortable: true,
                comparator: (valueA, valueB) => {
                    const timeA = valueA ? new Date(valueA).getTime() : 0;
                    const timeB = valueB ? new Date(valueB).getTime() : 0;
                    return timeA - timeB;
                },
                valueFormatter: ({ value }) => formatLastSeen(value),
            },
            {
                headerName: 'Verified',
                field: 'email_verified_at',
                flex: 0.7,
                valueFormatter: ({ value }) => (value ? 'Verified' : 'Pending'),
                cellRenderer: ({ value }) => (
                    <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            value ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}
                    >
                        {value ? 'Verified' : 'Pending'}
                    </span>
                ),
            },
            {
                headerName: 'Created',
                field: 'created_at',
                flex: 0.8,
                valueFormatter: ({ value }) => (value ? new Date(value).toLocaleDateString() : '-'),
            },
            {
                headerName: 'Actions',
                field: 'id',
                maxWidth: 180,
                cellRenderer: ({ value, data }) => {
                    if (data.rowType !== 'data') {
                        return null;
                    }
                    return (
                        <div className="flex items-center gap-2">
                            <Link
                                href={`/admin/users/${value}/edit`}
                                className="rounded-full border border-stone-200 px-3 py-1 text-xs font-semibold"
                            >
                                Edit
                            </Link>
                            <button
                                type="button"
                                onClick={() => onDelete(value)}
                                className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700"
                            >
                                Delete
                            </button>
                        </div>
                    );
                },
            },
        ],
        [expandedIds, roleOptions, toggleExpand],
    );

    const onDelete = (id) => {
        if (!confirm('Delete this user?')) {
            return;
        }

        router.delete(`/admin/users/${id}`);
    };

    const onCellValueChanged = async (params) => {
        const { data, colDef, newValue, oldValue } = params;

        if (data.rowType !== 'data') {
            return;
        }

        if (newValue === oldValue) {
            return;
        }

        try {
            await window.axios.patch(`/admin/users/${data.id}/inline`, {
                field: colDef.field,
                value: newValue,
            });
        } catch (error) {
            params.node.setDataValue(colDef.field, oldValue);
            alert('Update failed. Please check the value and try again.');
        }
    };

    const filteredRows = useMemo(() => {
        const normalized = search.trim().toLowerCase();
        return userRows.filter((user) => {
            if (roleFilter !== 'all' && user.role !== roleFilter) {
                return false;
            }

            if (!normalized) {
                return true;
            }

            return (
                user.name?.toLowerCase().includes(normalized) ||
                user.email?.toLowerCase().includes(normalized) ||
                user.role?.toLowerCase().includes(normalized) ||
                (user.is_online ? 'online' : 'offline').includes(normalized) ||
                roleLabel(user.role).toLowerCase().includes(normalized)
            );
        });
    }, [userRows, roleFilter, search]);

    const rowData = useMemo(() => {
        const rows = [];
        filteredRows.forEach((user) => {
            rows.push({ ...user, rowType: 'data' });
            if (expandedIds.has(user.id)) {
                rows.push({
                    __detail: true,
                    parentId: user.id,
                    ...user,
                    rowType: 'detail',
                });
            }
        });
        return rows;
    }, [filteredRows, expandedIds]);

    const postSortRows = useCallback((params) => {
        const detailMap = new Map();
        params.nodes.forEach((node) => {
            if (node.data?.rowType === 'detail') {
                detailMap.set(node.data.parentId, node);
            }
        });

        const newNodes = [];
        params.nodes.forEach((node) => {
            if (node.data?.rowType === 'detail') {
                return;
            }
            newNodes.push(node);
            const detailNode = detailMap.get(node.data?.id);
            if (detailNode) {
                newNodes.push(detailNode);
            }
        });

        params.nodes.length = 0;
        params.nodes.push(...newNodes);
    }, []);

    return (
        <AdminLayout title="Users">
            <Head title="Users" />

            <div className="flex flex-col gap-6">
                <div>
                    <h3 className="text-3xl font-semibold text-[var(--text-main)]">User Directory</h3>
                    <p className="text-sm text-[var(--text-muted)]"> Manage users, roles, and inline updates directly in the table. </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <Metric label="Total Users" value={totals.total} />
                    <Metric label="Admins" value={totals.admins} />
                    <Metric label="Online" value={totals.online} />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex gap-2 rounded-full border border-stone-200 bg-white px-2 py-1 text-sm">
                        <Tab label="All" active={roleFilter === 'all'} onClick={() => setRoleFilter('all')} />
                        <Tab label="Admin" active={roleFilter === 'admin'} onClick={() => setRoleFilter('admin')} />
                        <Tab label="User" active={roleFilter === 'user'} onClick={() => setRoleFilter('user')} />
                        <Tab label="Nhập liệu" active={roleFilter === 'nhap_lieu'} onClick={() => setRoleFilter('nhap_lieu')} />
                    </div>

                    <div className="flex flex-1 items-center gap-3">
                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search users..."
                            className="w-full max-w-sm rounded-full border border-stone-200 bg-white px-4 py-2 text-sm"
                        />
                        <button
                            type="button"
                            onClick={() => gridRef.current?.api.exportDataAsCsv()}
                            className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold"
                        >
                            Export CSV
                        </button>
                        <Link
                            href="/admin/users/create"
                            className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white"
                        >
                            Create User
                        </Link>
                    </div>
                </div>
            </div>

            <div className="mt-6 rounded-3xl border border-[var(--panel-border)] bg-white/90 p-6 shadow-[0_18px_40px_rgba(45,28,17,0.08)]">
                <div className="ag-theme-quartz h-[560px] overflow-hidden rounded-2xl border border-stone-200">
                    <AgGridReact
                        ref={gridRef}
                        columnDefs={columnDefs}
                        autoSizeStrategy={{ type: 'fitCellContents' }}
                        defaultColDef={{
                            sortable: true,
                            filter: false,
                            floatingFilter: false,
                            resizable: true,
                            editable: (params) => params.data?.rowType === 'data',
                            minWidth: 100,
                            maxWidth: 560,
                        }}
                        rowData={rowData}
                        pagination
                        paginationPageSize={10}
                        onCellValueChanged={onCellValueChanged}
                        postSortRows={postSortRows}
                        getRowHeight={(params) => {
                            if (!params.data?.__detail) {
                                return 64;
                            }
                            const count = params.data.projects ? params.data.projects.length : 0;
                            return Math.max(220, 150 + count * 36);
                        }}
                        getRowId={(params) =>
                            params.data?.__detail ? `detail-${params.data.parentId}` : `data-${params.data.id}`
                        }
                    />
                </div>
            </div>
        </AdminLayout>
    );
}

function Metric({ label, value }) {
    return (
        <div className="rounded-2xl border border-[var(--panel-border)] bg-white/80 px-5 py-4 shadow-[0_18px_40px_rgba(45,28,17,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-main)]">{value}</p>
        </div>
    );
}

function Tab({ label, active, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-full px-4 py-2 text-xs font-semibold ${
                active ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-muted)]'
            }`}
        >
            {label}
        </button>
    );
}

function DetailPanel({ data }) {
    const rows = (data.projects ?? []).map((project, index) => ({
        name: project,
        type: index % 2 === 0 ? 'Operational' : 'Strategic',
        status: index % 3 === 0 ? 'Active' : 'Planned',
        year: 2024 + (index % 2),
    }));

    return (
        <div className="rounded-2xl border border-stone-200 bg-stone-50/80 px-5 py-4">
            <div className="grid gap-4 md:grid-cols-4">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Phone</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--text-main)]">{data.phone ?? '-'}</p>
                </div>
                <div className="md:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Address</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--text-main)]">{data.address ?? '-'}</p>
                </div>
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Role</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--text-main)]">{data.role ?? '-'}</p>
                </div>
            </div>

            <div className="mt-4 rounded-xl border border-stone-200 bg-white">
                <div className="grid grid-cols-4 gap-4 border-b border-stone-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                    <div>Project</div>
                    <div>Type</div>
                    <div>Status</div>
                    <div>Year</div>
                </div>
                <div className="divide-y divide-stone-200">
                    {rows.map((row) => (
                        <div key={`${row.name}-${row.year}`} className="grid grid-cols-4 gap-4 px-4 py-2 text-sm text-[var(--text-main)]">
                            <div className="font-semibold">{row.name}</div>
                            <div>{row.type}</div>
                            <div className="text-[var(--text-muted)]">{row.status}</div>
                            <div className="text-[var(--text-muted)]">{row.year}</div>
                        </div>
                    ))}
                    {rows.length === 0 && (
                        <div className="px-4 py-3 text-sm text-[var(--text-muted)]">No projects assigned</div>
                    )}
                </div>
            </div>
        </div>
    );
}

