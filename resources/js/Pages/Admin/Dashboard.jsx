import AdminLayout from '../../Layouts/AdminLayout';
import { Head } from '@inertiajs/react';

export default function Dashboard({ stats = {} }) {
    const cards = [
        { label: 'Users', value: stats.users ?? 0 },
        { label: 'Admins', value: stats.admins ?? 0 },
        { label: 'Online Users', value: stats.onlineUsers ?? 0 },
        { label: 'Tổng hồ sơ', value: stats.totalArchiveRecords ?? 0 },
        { label: 'Tổng tài liệu', value: stats.totalDocuments ?? 0 },
        { label: 'Hồ sơ nhập trong ngày', value: stats.todayArchiveRecords ?? 0 },
        { label: 'Tài liệu nhập trong ngày', value: stats.todayDocuments ?? 0 },
    ];

    return (
        <AdminLayout title="Dashboard">
            <Head title="Admin Dashboard" />

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                {cards.map((card) => (
                    <Card key={card.label} label={card.label} value={card.value} />
                ))}
            </div>
        </AdminLayout>
    );
}

function Card({ label, value }) {
    return (
        <div className="rounded-2xl border border-[var(--panel-border)] bg-white/80 px-5 py-6 shadow-[0_18px_40px_rgba(45,28,17,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">{label}</p>
            <p className="mt-3 text-3xl font-semibold text-[var(--text-main)]">{value}</p>
        </div>
    );
}
