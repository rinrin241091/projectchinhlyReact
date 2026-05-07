<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class EnsureRole
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

    private function redirectByRole(string $normalizedRole): ?string
    {
        if ($normalizedRole === 'admin') {
            return route('admin.dashboard');
        }

        if ($normalizedRole === 'nhap_lieu') {
            return route('admin.documents.index');
        }

        if ($normalizedRole === 'user') {
            return route('dashboard');
        }

        return null;
    }

    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return redirect()->route('login');
        }

        if (empty($roles)) {
            return $next($request);
        }

        $normalizedUserRole = $this->normalizeRole($user->role);
        $normalizedRoles = array_map(fn (string $role) => $this->normalizeRole($role), $roles);

        if (! in_array($normalizedUserRole, $normalizedRoles, true)) {
            if ($request->expectsJson() || ! $request->isMethod('GET')) {
                abort(403);
            }

            $target = $this->redirectByRole($normalizedUserRole);

            if ($target) {
                return redirect()->to($target);
            }

            abort(403);
        }

        return $next($request);
    }
}
