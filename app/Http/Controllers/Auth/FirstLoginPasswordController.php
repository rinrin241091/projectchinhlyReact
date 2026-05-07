<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

class FirstLoginPasswordController extends Controller
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

    public function edit(Request $request): Response
    {
        abort_unless($request->user(), 403);

        return Inertia::render('Auth/ForceChangePassword');
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'password' => ['required', Password::defaults(), 'confirmed'],
        ]);

        $user = $request->user();
        abort_unless($user, 403);

        $user->password = Hash::make($validated['password']);
        $user->must_change_password = false;
        $user->save();

        $normalizedRole = $this->normalizeRole($user->role);
        if ($normalizedRole === 'admin') {
            return redirect()->route('admin.dashboard');
        }
        if ($normalizedRole === 'nhap_lieu') {
            return redirect()->route('admin.documents.index');
        }

        return redirect()->route('dashboard');
    }
}
