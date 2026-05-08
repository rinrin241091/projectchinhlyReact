<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

class UserController extends Controller
{
    private function normalizeRole(?string $role): string
    {
        return (string) Str::of((string) $role)
            ->trim()
            ->lower()
            ->ascii()
            ->replaceMatches('/[^a-z0-9]+/', '_')
            ->trim('_');
    }

    private function canonicalRole(?string $role): string
    {
        $normalized = $this->normalizeRole($role);

        return in_array($normalized, ['admin', 'super_admin', 'user', 'nhap_lieu'], true)
            ? $normalized
            : 'user';
    }

    public function index(): Response
    {
        return Inertia::render('Admin/Users/Index', [
            'users' => User::query()
                ->select(['id', 'name', 'email', 'role', 'email_verified_at', 'created_at', 'last_seen_at'])
                ->orderBy('id', 'desc')
                ->get()
                ->map(fn (User $user) => $this->mapUserRow($user)),
        ]);
    }

    public function presence(): JsonResponse
    {
        $users = User::query()
            ->select(['id', 'last_seen_at'])
            ->get()
            ->map(fn (User $user) => [
                'id' => $user->id,
                'last_seen_at' => $user->last_seen_at,
                'is_online' => $this->isUserOnline($user),
            ]);

        return response()->json([
            'users' => $users,
        ]);
    }

    public function create(): Response
    {
        return Inertia::render('Admin/Users/Create');
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'role' => ['required', Rule::in(['admin', 'super_admin', 'user', 'nhap_lieu'])],
        ]);

        $role = $this->canonicalRole($data['role']);

        User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'role' => $role,
            'must_change_password' => true,
            'email_verified_at' => in_array($role, ['admin', 'super_admin'], true) ? now() : null,
        ]);

        return redirect()->route('admin.users.index');
    }

    public function edit(User $user): Response
    {
        return Inertia::render('Admin/Users/Edit', [
            'user' => $user->only(['id', 'name', 'email', 'role']),
        ]);
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($user->id),
            ],
            'password' => ['nullable', 'string', 'min:8'],
            'role' => ['required', Rule::in(['admin', 'super_admin', 'user', 'nhap_lieu'])],
        ]);

        $user->name = $data['name'];
        $user->email = $data['email'];
        $user->role = $this->canonicalRole($data['role']);

        if (in_array($user->role, ['admin', 'super_admin'], true) && ! $user->email_verified_at) {
            $user->email_verified_at = now();
        }

        if (! empty($data['password'])) {
            $user->password = Hash::make($data['password']);
        }

        $user->save();

        return redirect()->route('admin.users.index');
    }

    public function updateInline(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'field' => ['required', Rule::in(['name', 'email', 'role'])],
            'value' => ['required'],
        ]);

        if ($data['field'] === 'name') {
            $request->validate([
                'value' => ['required', 'string', 'max:255'],
            ]);
            $user->name = $data['value'];
        }

        if ($data['field'] === 'email') {
            $request->validate([
                'value' => [
                    'required',
                    'email',
                    'max:255',
                    Rule::unique('users', 'email')->ignore($user->id),
                ],
            ]);
            $user->email = $data['value'];
        }

        if ($data['field'] === 'role') {
            $request->validate([
                'value' => ['required', Rule::in(['admin', 'user', 'nhap_lieu'])],
            ]);
            $user->role = $this->canonicalRole($data['value']);
        }

        $user->save();

        return response()->json([
            'ok' => true,
        ]);
    }

    public function destroy(User $user): RedirectResponse
    {
        if ($user->id === auth()->id()) {
            return redirect()->route('admin.users.index');
        }

        $user->delete();

        return redirect()->route('admin.users.index');
    }

    private function mapUserRow(User $user): array
    {
        $projects = [
            'Manager Pro',
            'CRM Sync',
            'Payroll Hub',
            'Warehouse App',
            'Sales Portal',
        ];

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'email_verified_at' => $user->email_verified_at,
            'created_at' => $user->created_at,
            'last_seen_at' => $user->last_seen_at,
            'is_online' => $this->isUserOnline($user),
            'phone' => '+84 9' . str_pad((string) (($user->id * 131) % 10000000), 7, '0', STR_PAD_LEFT),
            'address' => 'Ward ' . (($user->id % 9) + 1) . ', District ' . (($user->id % 5) + 1) . ', HCMC',
            'projects' => array_slice($projects, 0, ($user->id % 3) + 1),
        ];
    }

    private function isUserOnline(User $user): bool
    {
        return $user->last_seen_at instanceof Carbon
            && $user->last_seen_at->greaterThanOrEqualTo(now()->subMinutes(2));
    }
}
