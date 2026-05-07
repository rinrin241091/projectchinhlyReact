import AdminLayout from '../../../Layouts/AdminLayout';
import { Head } from '@inertiajs/react';

export default function Index({ rows = [], summary = {} }) {
    const totalDocuments = Number(summary.totalDocuments ?? 0);
    const organizationLabel = summary.organizationLabel ?? 'Tất cả';

    return (
        <AdminLayout title="Sản lượng">
            <Head title="Sản lượng nhập liệu" />

            <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    <Card label="Nhân viên nhập liệu" value={summary.totalEmployees ?? 0} />
                    <Card label="Tổng số tài liệu nhập" value={totalDocuments} />
                    <Card label="Phông đang chọn" value={organizationLabel} />
                </div>

                <section className="rounded-2xl border border-[var(--panel-border)] bg-white/85 p-5 shadow-[0_18px_40px_rgba(45,28,17,0.08)]">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <h3 className="text-lg font-semibold text-[var(--text-main)]">Thống kê sản lượng nhân viên</h3>
                        <a
                            href="/admin/productivity/export"
                            className="inline-flex items-center rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-[var(--text-main)]"
                        >
                            Xuất Excel
                        </a>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse text-sm">
                            <thead>
                                <tr className="bg-stone-100 text-left text-[var(--text-main)]">
                                    <th className="border border-stone-200 px-3 py-2">STT</th>
                                    <th className="border border-stone-200 px-3 py-2">Nhân viên</th>
                                    <th className="border border-stone-200 px-3 py-2">Email</th>
                                    <th className="border border-stone-200 px-3 py-2">Vai trò</th>
                                    <th className="border border-stone-200 px-3 py-2">Tổng số tài liệu nhập</th>
                                    <th className="border border-stone-200 px-3 py-2">Tỷ lệ (%)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="border border-stone-200 px-3 py-4 text-center text-[var(--text-muted)]"
                                        >
                                            Chưa có dữ liệu sản lượng cho phông đang chọn.
                                        </td>
                                    </tr>
                                )}
                                {rows.map((row) => {
                                    const percent =
                                        totalDocuments > 0
                                            ? ((Number(row.totalDocuments ?? 0) / totalDocuments) * 100).toFixed(2)
                                            : '0.00';

                                    return (
                                        <tr key={row.id} className="even:bg-stone-50/60">
                                            <td className="border border-stone-200 px-3 py-2">{row.stt}</td>
                                            <td className="border border-stone-200 px-3 py-2 font-semibold text-[var(--text-main)]">
                                                {row.name}
                                            </td>
                                            <td className="border border-stone-200 px-3 py-2">{row.email}</td>
                                            <td className="border border-stone-200 px-3 py-2">{row.roleLabel}</td>
                                            <td className="border border-stone-200 px-3 py-2 text-right">
                                                {row.totalDocuments}
                                            </td>
                                            <td className="border border-stone-200 px-3 py-2 text-right">{percent}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </AdminLayout>
    );
}

function Card({ label, value }) {
    return (
        <div className="rounded-2xl border border-[var(--panel-border)] bg-white/80 px-5 py-5 shadow-[0_18px_40px_rgba(45,28,17,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">{label}</p>
            <p className="mt-3 text-3xl font-semibold text-[var(--text-main)]">{value}</p>
        </div>
    );
}

