import AdminLayout from '../../../Layouts/AdminLayout';
import { Head, useForm } from '@inertiajs/react';

export default function Create() {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        email: '',
        password: '',
        role: 'user',
    });

    const submit = (event) => {
        event.preventDefault();
        post('/admin/users');
    };

    return (
        <AdminLayout title="Create User">
            <Head title="Create User" />

            <form onSubmit={submit} className="max-w-2xl rounded-3xl border border-[var(--panel-border)] bg-white/90 p-8 shadow-[0_18px_40px_rgba(45,28,17,0.08)]">
                <Field label="Name" error={errors.name}>
                    <input
                        type="text"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        className="w-full rounded-xl border border-stone-200 px-4 py-3"
                    />
                </Field>

                <Field label="Email" error={errors.email}>
                    <input
                        type="email"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        className="w-full rounded-xl border border-stone-200 px-4 py-3"
                    />
                </Field>

                <Field label="Password" error={errors.password}>
                    <input
                        type="password"
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        className="w-full rounded-xl border border-stone-200 px-4 py-3"
                    />
                </Field>

                <Field label="Role" error={errors.role}>
                    <select
                        value={data.role}
                        onChange={(e) => setData('role', e.target.value)}
                        className="w-full rounded-xl border border-stone-200 px-4 py-3"
                    >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                        <option value="nhap_lieu">Nhập liệu</option>
                    </select>
                </Field>

                <button
                    type="submit"
                    disabled={processing}
                    className="mt-4 rounded-full bg-[var(--accent)] px-6 py-2 text-sm font-semibold text-white"
                >
                    Save
                </button>
            </form>
        </AdminLayout>
    );
}

function Field({ label, error, children }) {
    return (
        <div className="mb-5">
            <label className="mb-2 block text-sm font-semibold text-[var(--text-main)]">{label}</label>
            {children}
            {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
        </div>
    );
}
