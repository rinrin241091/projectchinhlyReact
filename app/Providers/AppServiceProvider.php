<?php

namespace App\Providers;

use App\Models\Organization;
use Inertia\Inertia;
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Vite::prefetch(concurrency: 3);

        Inertia::share('adminFilters', function () {
            $selectedOrganizationId = request()->session()->get('admin.organization_id');

            return [
                'organizations' => Organization::query()
                    ->orderBy('name')
                    ->get(['id', 'name']),
                'selectedOrganizationId' => $selectedOrganizationId,
            ];
        });
    }
}
