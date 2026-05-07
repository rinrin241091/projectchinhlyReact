import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Head, useForm } from '@inertiajs/react';

export default function ForceChangePassword() {
    const { data, setData, put, processing, errors, reset } = useForm({
        password: '',
        password_confirmation: '',
    });

    const submit = (event) => {
        event.preventDefault();

        put(route('password.first-login.update'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-stone-100 px-4 py-10">
            <Head title="Đổi mật khẩu lần đầu" />

            <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                <h1 className="text-xl font-semibold text-stone-900">Đổi mật khẩu lần đăng nhập đầu</h1>
                <p className="mt-2 text-sm text-stone-600">
                    Bạn cần đổi mật khẩu trước khi tiếp tục sử dụng hệ thống.
                </p>

                <form onSubmit={submit} className="mt-6 space-y-4">
                    <div>
                        <InputLabel htmlFor="password" value="Mật khẩu mới" />
                        <TextInput
                            id="password"
                            type="password"
                            name="password"
                            className="mt-1 block w-full"
                            value={data.password}
                            onChange={(event) => setData('password', event.target.value)}
                            autoFocus
                            autoComplete="new-password"
                        />
                        <InputError className="mt-2" message={errors.password} />
                    </div>

                    <div>
                        <InputLabel htmlFor="password_confirmation" value="Xác nhận mật khẩu mới" />
                        <TextInput
                            id="password_confirmation"
                            type="password"
                            name="password_confirmation"
                            className="mt-1 block w-full"
                            value={data.password_confirmation}
                            onChange={(event) => setData('password_confirmation', event.target.value)}
                            autoComplete="new-password"
                        />
                    </div>

                    <div className="pt-2">
                        <PrimaryButton disabled={processing}>Cập nhật mật khẩu</PrimaryButton>
                    </div>
                </form>
            </div>
        </div>
    );
}

