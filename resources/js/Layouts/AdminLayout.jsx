import { Link, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';

export default function AdminLayout({ title, children }) {
    const page = usePage();
    const { auth, adminFilters } = page.props;
    const user = auth?.user;
    const organizations = adminFilters?.organizations ?? [];
    const selectedOrganizationId = adminFilters?.selectedOrganizationId ?? '';
    const [selectedOrg, setSelectedOrg] = useState(
        selectedOrganizationId === null || selectedOrganizationId === undefined ? '' : String(selectedOrganizationId),
    );
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const normalizedRole = String(user?.role ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\s-]+/g, '_');
    const isDataEntry = normalizedRole === 'nhap_lieu';

    useEffect(() => {
        setSelectedOrg(
            selectedOrganizationId === null || selectedOrganizationId === undefined
                ? ''
                : String(selectedOrganizationId),
        );
    }, [selectedOrganizationId]);

    useEffect(() => {
        const saved = window.localStorage.getItem('admin.sidebar.collapsed');
        setIsSidebarCollapsed(saved === '1');
    }, []);

    useEffect(() => {
        if (!user?.id || typeof window === 'undefined' || !window.axios) {
            return undefined;
        }

        let cancelled = false;

        const pingPresence = () => {
            if (cancelled) {
                return;
            }

            window.axios.post('/presence/ping').catch(() => {});
        };

        pingPresence();
        const intervalId = window.setInterval(pingPresence, 30000);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
        };
    }, [user?.id]);

    const onOrganizationChange = async (event) => {
        const value = event.target.value;
        setSelectedOrg(value);
        try {
            await window.axios.post('/admin/organization-filter', {
                organization_id: value || null,
            });
            window.location.reload();
        } catch (error) {
            alert('Cập nhật bộ lọc thất bại. Vui lòng thử lại.');
        }
    };

    const onToggleSidebar = () => {
        setIsSidebarCollapsed((current) => {
            const next = !current;
            window.localStorage.setItem('admin.sidebar.collapsed', next ? '1' : '0');
            return next;
        });
    };

    const links = useMemo(() => {
        if (isDataEntry) {
            return [{ href: '/admin/documents', label: 'Biên mục tài liệu' }];
        }

        return [
            { href: '/admin', label: 'Dashboard' },
            { href: '/admin/productivity', label: 'Sản lượng' },
            { href: '/admin/users', label: 'Users' },
            { href: '/admin/records', label: 'Danh mục tổng quan' },
            { href: '/admin/archive-record-items', label: 'Mục lục hồ sơ (DB)' },
            { href: '/admin/archives', label: 'Cơ quan lưu trữ' },
            { href: '/admin/organizations', label: 'Phông lưu trữ' },
            { href: '/admin/storages', label: 'Kho lưu trữ' },
            { href: '/admin/shelves', label: 'Danh sách kệ' },
            { href: '/admin/boxes', label: 'Danh sách hộp' },
            { href: '/admin/record-types', label: 'Loại hồ sơ' },
            { href: '/admin/doc-types', label: 'Loại văn bản' },
            { href: '/admin/archive-records', label: 'Hồ sơ lưu trữ' },
            { href: '/admin/documents', label: 'Biên mục tài liệu' },
        ];
    }, [isDataEntry]);

    return (
        <div className="min-h-screen bg-transparent">
            <div className="flex min-h-screen">
                <div className="relative hidden lg:flex">
                    <aside
                        className={`flex flex-col border-r border-[var(--panel-border)] bg-white/90 py-8 backdrop-blur transition-all duration-200 ${
                            isSidebarCollapsed ? 'w-20 px-3' : 'w-64 px-6'
                        }`}
                    >
                        <div className="mb-10">
                            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--accent)]">
                                {isSidebarCollapsed ? 'MP' : 'ManagerPro'}
                            </p>
                            {!isSidebarCollapsed && (
                                <h1 className="mt-2 text-2xl font-semibold text-[var(--text-main)]">Admin Panel</h1>
                            )}
                        </div>

                        <nav className="flex flex-1 flex-col gap-2 text-sm font-medium text-[var(--text-muted)]">
                            {links.map((link) => (
                                <NavLink
                                    key={link.href}
                                    href={link.href}
                                    label={link.label}
                                    collapsed={isSidebarCollapsed}
                                    currentUrl={page.url}
                                />
                            ))}
                        </nav>

                        <div className="mt-auto rounded-2xl border border-stone-200 bg-stone-50 px-3 py-3 text-xs text-[var(--text-muted)]">
                            <div className="font-semibold text-[var(--text-main)]">
                                {isSidebarCollapsed ? 'AD' : user?.name ?? 'Admin'}
                            </div>
                            {!isSidebarCollapsed && (
                                <div className="mt-1 uppercase tracking-[0.2em]">{roleLabel(user?.role)}</div>
                            )}
                        </div>
                    </aside>

                    <button
                        type="button"
                        onClick={onToggleSidebar}
                        title={isSidebarCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
                        className="fixed z-20 flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold text-white shadow-sm"
                        style={{
                            top: '50vh',
                            left: isSidebarCollapsed ? '80px' : '256px',
                            transform: 'translate(-50%, -50%)',
                            backgroundColor: '#292524',
                            borderColor: '#44403c',
                        }}
                    >
                        {isSidebarCollapsed ? '>' : '<'}
                    </button>
                </div>

                <div className="flex min-h-screen flex-1 flex-col">
                    <header className="flex items-center justify-between border-b border-[var(--panel-border)] bg-white/70 px-6 py-4 backdrop-blur">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--accent)]">Admin</p>
                            <h2 className="text-2xl font-semibold text-[var(--text-main)]">{title}</h2>
                        </div>

                        <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
                            <div className="hidden items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)] xl:flex">
                                <span>Phông</span>
                                <select
                                    value={selectedOrg}
                                    onChange={onOrganizationChange}
                                    className="rounded-full border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-[var(--text-main)]"
                                >
                                    <option value="">Tất cả</option>
                                    {organizations.map((organization) => (
                                        <option key={organization.id} value={organization.id}>
                                            {organization.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <span>{user?.email}</span>
                            <Link
                                href="/logout"
                                method="post"
                                as="button"
                                className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-[var(--text-main)]"
                            >
                                Logout
                            </Link>
                        </div>
                    </header>

                    <main className="flex-1 px-4 py-8 sm:px-6 lg:px-10">{children}</main>
                </div>
            </div>
        </div>
    );
}

function NavLink({ href, label, collapsed, currentUrl }) {
    const isActive = currentUrl === href || currentUrl.startsWith(`${href}/`);
    const initials = getInitials(label);

    return (
        <Link
            href={href}
            title={collapsed ? label : undefined}
            className={`rounded-xl px-3 py-2 transition ${
                collapsed ? 'flex justify-center' : 'flex items-center'
            } ${
                isActive
                    ? 'bg-stone-100 font-semibold text-[var(--text-main)]'
                    : 'hover:bg-stone-100 hover:text-[var(--text-main)]'
            }`}
        >
            {collapsed ? (
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-[10px] font-semibold uppercase text-[var(--text-main)]">
                    {initials}
                </span>
            ) : (
                <span className="truncate">{label}</span>
            )}
        </Link>
    );
}

function getInitials(label) {
    const words = String(label)
        .split(/\s+/)
        .filter(Boolean);
    if (words.length === 0) {
        return 'M';
    }
    if (words.length === 1) {
        return words[0].slice(0, 2).toUpperCase();
    }
    return `${words[0][0] ?? ''}${words[1][0] ?? ''}`.toUpperCase();
}

function roleLabel(role) {
    const normalizedRole = String(role ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[\s-]+/g, '_');

    if (normalizedRole === 'admin') {
        return 'admin';
    }
    if (normalizedRole === 'nhap_lieu') {
        return 'nhập liệu';
    }
    return 'user';
}
