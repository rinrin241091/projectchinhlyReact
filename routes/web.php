<?php

use App\Http\Controllers\Admin\ArchivalController;
use App\Http\Controllers\Admin\BoxController;
use App\Http\Controllers\Admin\ArchiveRecordItemController;
use App\Http\Controllers\Admin\OrganizationController;
use App\Http\Controllers\Admin\RecordTypeController;
use App\Http\Controllers\Admin\RecordOverviewController;
use App\Http\Controllers\Admin\DocTypeController;
use App\Http\Controllers\Admin\ArchiveRecordController;
use App\Http\Controllers\Admin\DocumentController;
use App\Http\Controllers\Admin\ProductivityController;
use App\Http\Controllers\Admin\ShelfController;
use App\Http\Controllers\Admin\StorageController;
use App\Http\Controllers\Admin\UserController;
use App\Models\ArchiveRecord;
use App\Models\Document;
use App\Models\User;
use App\Http\Controllers\ProfileController;
use Illuminate\Foundation\Application;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});

Route::get('/dashboard', function () {
    return Inertia::render('Dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::post('/presence/ping', function (Request $request) {
        $user = $request->user();
        if ($user) {
            $user->forceFill([
                'last_seen_at' => now(),
            ])->save();
        }

        return response()->json(['ok' => true]);
    })->name('presence.ping');

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

Route::middleware(['auth'])
    ->prefix('admin')
    ->name('admin.')
    ->group(function () {
        Route::middleware('role:admin,super_admin')->group(function () {
            Route::get('/', function () {
                $today = now()->toDateString();
                $onlineUsers = User::query()
                    ->whereNotNull('last_seen_at')
                    ->where('last_seen_at', '>=', now()->subMinutes(2))
                    ->count();
                $selectedOrganizationId = request()->session()->get('admin.organization_id');

                $archiveRecordsQuery = ArchiveRecord::query();
                $documentsQuery = Document::query();

                if ($selectedOrganizationId) {
                    $archiveRecordsQuery->whereIn('archive_record_item_id', function ($query) use ($selectedOrganizationId) {
                        $query
                            ->select('id')
                            ->from('archive_record_items')
                            ->where('organization_id', (int) $selectedOrganizationId);
                    });

                    $documentsQuery->whereIn('archive_record_id', function ($query) use ($selectedOrganizationId) {
                        $query
                            ->select('archive_records.id')
                            ->from('archive_records')
                            ->join('archive_record_items', 'archive_record_items.id', '=', 'archive_records.archive_record_item_id')
                            ->where('archive_record_items.organization_id', (int) $selectedOrganizationId);
                    });
                }

                return Inertia::render('Admin/Dashboard', [
                    'stats' => [
                        'users' => User::query()->count(),
                        'admins' => User::query()->where('role', 'admin')->count(),
                        'onlineUsers' => $onlineUsers,
                        'totalArchiveRecords' => (clone $archiveRecordsQuery)->count(),
                        'totalDocuments' => (clone $documentsQuery)->count(),
                        'todayArchiveRecords' => (clone $archiveRecordsQuery)->whereDate('created_at', $today)->count(),
                        'todayDocuments' => (clone $documentsQuery)->whereDate('created_at', $today)->count(),
                    ],
                ]);
            })->name('dashboard');

            Route::resource('users', UserController::class)->except(['show']);
            Route::patch('users/{user}/inline', [UserController::class, 'updateInline'])->name('users.inline');
            Route::get('users/presence', [UserController::class, 'presence'])->name('users.presence');

            Route::get('records', [RecordOverviewController::class, 'index'])->name('records.index');

            Route::get('archives', [ArchivalController::class, 'index'])->name('archives.index');
            Route::post('archives', [ArchivalController::class, 'store'])->name('archives.store');
            Route::patch('archives/{archival}', [ArchivalController::class, 'update'])->name('archives.update');
            Route::delete('archives/{archival}', [ArchivalController::class, 'destroy'])->name('archives.destroy');

            Route::get('organizations', [OrganizationController::class, 'index'])->name('organizations.index');
            Route::post('organizations', [OrganizationController::class, 'store'])->name('organizations.store');
            Route::patch('organizations/{organization}', [OrganizationController::class, 'update'])->name('organizations.update');
            Route::delete('organizations/{organization}', [OrganizationController::class, 'destroy'])->name('organizations.destroy');

            Route::get('storages', [StorageController::class, 'index'])->name('storages.index');
            Route::post('storages', [StorageController::class, 'store'])->name('storages.store');
            Route::patch('storages/{storage}', [StorageController::class, 'update'])->name('storages.update');
            Route::delete('storages/{storage}', [StorageController::class, 'destroy'])->name('storages.destroy');

            Route::get('shelves', [ShelfController::class, 'index'])->name('shelves.index');
            Route::post('shelves', [ShelfController::class, 'store'])->name('shelves.store');
            Route::patch('shelves/{shelf}', [ShelfController::class, 'update'])->name('shelves.update');
            Route::delete('shelves/{shelf}', [ShelfController::class, 'destroy'])->name('shelves.destroy');

            Route::get('boxes', [BoxController::class, 'index'])->name('boxes.index');
            Route::post('boxes', [BoxController::class, 'store'])->name('boxes.store');
            Route::patch('boxes/{box}', [BoxController::class, 'update'])->name('boxes.update');
            Route::delete('boxes/{box}', [BoxController::class, 'destroy'])->name('boxes.destroy');

            Route::get('archive-record-items', [ArchiveRecordItemController::class, 'index'])->name('archive-record-items.index');
            Route::post('archive-record-items', [ArchiveRecordItemController::class, 'store'])->name('archive-record-items.store');
            Route::patch('archive-record-items/{archiveRecordItem}', [ArchiveRecordItemController::class, 'update'])->name('archive-record-items.update');
            Route::delete('archive-record-items/{archiveRecordItem}', [ArchiveRecordItemController::class, 'destroy'])->name('archive-record-items.destroy');

            Route::get('record-types', [RecordTypeController::class, 'index'])->name('record-types.index');
            Route::post('record-types', [RecordTypeController::class, 'store'])->name('record-types.store');
            Route::patch('record-types/{recordType}', [RecordTypeController::class, 'update'])->name('record-types.update');
            Route::delete('record-types/{recordType}', [RecordTypeController::class, 'destroy'])->name('record-types.destroy');

            Route::get('doc-types', [DocTypeController::class, 'index'])->name('doc-types.index');
            Route::post('doc-types', [DocTypeController::class, 'store'])->name('doc-types.store');
            Route::patch('doc-types/{docType}', [DocTypeController::class, 'update'])->name('doc-types.update');
            Route::delete('doc-types/{docType}', [DocTypeController::class, 'destroy'])->name('doc-types.destroy');

            Route::get('archive-records', [ArchiveRecordController::class, 'index'])->name('archive-records.index');
            Route::post('archive-records', [ArchiveRecordController::class, 'store'])->name('archive-records.store');
            Route::patch('archive-records/{archiveRecord}', [ArchiveRecordController::class, 'update'])->name('archive-records.update');
            Route::delete('archive-records/{archiveRecord}', [ArchiveRecordController::class, 'destroy'])->name('archive-records.destroy');
            Route::get('archive-records/export', [ArchiveRecordController::class, 'export'])->name('archive-records.export');

            Route::get('documents/export-dang', [DocumentController::class, 'exportDang'])->name('documents.export-dang');
            Route::get('documents/export-dang-record', [DocumentController::class, 'exportDangRecord'])->name('documents.export-dang-record');

            Route::get('productivity', [ProductivityController::class, 'index'])->name('productivity.index');
            Route::get('productivity/export', [ProductivityController::class, 'export'])->name('productivity.export');
        });

        Route::middleware('role:admin,super_admin,nhap_lieu')->group(function () {
            Route::post('organization-filter', function (Request $request) {
                $organizationId = $request->input('organization_id');
                if ($organizationId) {
                    $request->session()->put('admin.organization_id', (int) $organizationId);
                } else {
                    $request->session()->forget('admin.organization_id');
                }
                return response()->json(['ok' => true]);
            })->name('organization-filter');

            Route::get('documents', [DocumentController::class, 'index'])->name('documents.index');
            Route::get('documents/rows', [DocumentController::class, 'rows'])->name('documents.rows');
            Route::post('documents', [DocumentController::class, 'store'])->name('documents.store');
            Route::post('documents/import-dang', [DocumentController::class, 'importDang'])->name('documents.import-dang');
            Route::patch('documents/{document}', [DocumentController::class, 'update'])->name('documents.update');
            Route::delete('documents/{document}', [DocumentController::class, 'destroy'])->name('documents.destroy');
        });
    });

require __DIR__.'/auth.php';
