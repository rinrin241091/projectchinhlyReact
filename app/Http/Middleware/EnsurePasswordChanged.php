<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePasswordChanged
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->must_change_password) {
            return $next($request);
        }

        $routeName = $request->route()?->getName();
        $allowedRoutes = [
            'password.first-login.edit',
            'password.first-login.update',
            'logout',
        ];

        if (in_array($routeName, $allowedRoutes, true)) {
            return $next($request);
        }

        return redirect()->route('password.first-login.edit');
    }
}

