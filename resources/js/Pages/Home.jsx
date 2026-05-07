import { Head } from '@inertiajs/react';
import { AgGridReact } from 'ag-grid-react';
import { useState } from 'react';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

const statusClasses = {
    Completed: 'bg-emerald-100 text-emerald-800',
    Review: 'bg-amber-100 text-amber-800',
    Blocked: 'bg-rose-100 text-rose-800',
    'In Progress': 'bg-sky-100 text-sky-800',
};

export default function Home({ stats, rows }) {
    const [columnDefs] = useState([
        { field: 'id', headerName: '#', maxWidth: 90 },
        { field: 'project', flex: 1.4 },
        { field: 'owner', flex: 1 },
        {
            field: 'status',
            flex: 1,
            cellRenderer: ({ value }) => (
                <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[value] ?? 'bg-stone-200 text-stone-700'}`}
                >
                    {value}
                </span>
            ),
        },
        {
            field: 'progress',
            flex: 1,
            valueFormatter: ({ value }) => `${value}%`,
        },
    ]);

    return (
        <>
            <Head title="ManagerPro Dashboard" />

            <main className="min-h-screen px-4 py-10 sm:px-6 lg:px-10">
                <div className="mx-auto flex max-w-7xl flex-col gap-8">
                    <section className="overflow-hidden rounded-[28px] border border-[var(--panel-border)] bg-[var(--panel-bg)] p-8 shadow-[0_20px_80px_rgba(45,28,17,0.08)] backdrop-blur">
                        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                            <div className="max-w-3xl">
                                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--accent)]">
                                    Laravel + Inertia + AG Grid
                                </p>
                                <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
                                    Nền khởi tạo đã sẵn sàng để bạn phát triển dashboard quản trị.
                                </h1>
                                <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-muted)]">
                                    Trang này đang được render bởi Laravel, điều hướng bởi Inertia React, và bảng dữ liệu bên dưới
                                    dùng AG Grid để bạn bắt đầu mở rộng module thật.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <StatCard label="Projects" value={stats.projects} />
                                <StatCard label="Tasks" value={stats.tasks} />
                                <StatCard label="Done Rate" value={`${stats.completionRate}%`} />
                            </div>
                        </div>
                    </section>

                    <section className="overflow-hidden rounded-[28px] border border-[var(--panel-border)] bg-white/88 p-6 shadow-[0_20px_80px_rgba(45,28,17,0.08)] backdrop-blur">
                        <div className="mb-5 flex flex-col gap-2">
                            <h2 className="text-2xl font-semibold">Project Overview</h2>
                            <p className="text-sm text-[var(--text-muted)]">
                                AG Grid đã hoạt động với dữ liệu mẫu từ route Laravel.
                            </p>
                        </div>

                        <div className="ag-theme-quartz h-[420px] overflow-hidden rounded-2xl border border-stone-200">
                            <AgGridReact
                                columnDefs={columnDefs}
                                defaultColDef={{
                                    sortable: true,
                                    filter: true,
                                    floatingFilter: true,
                                    resizable: true,
                                }}
                                rowData={rows ?? []}
                                pagination
                                paginationPageSize={5}
                            />
                        </div>
                    </section>
                </div>
            </main>
        </>
    );
}

function StatCard({ label, value }) {
    return (
        <div className="rounded-2xl border border-stone-200 bg-stone-50 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-[var(--text-main)]">{value}</p>
        </div>
    );
}
