<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\Shelf;
use App\Models\Storage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ShelfController extends Controller
{
    public function index(): Response
    {
        $selectedOrganizationId = request()->session()->get('admin.organization_id');
        $archivalId = null;
        if ($selectedOrganizationId) {
            $archivalId = Organization::query()
                ->whereKey($selectedOrganizationId)
                ->value('archival_id');
        }

        $storages = Storage::query()
            ->with('archival:id,name')
            ->when($archivalId, fn ($query) => $query->where('archival_id', $archivalId))
            ->orderBy('name')
            ->get(['id', 'name', 'archival_id'])
            ->map(function (Storage $storage) {
                return [
                    'id' => $storage->id,
                    'name' => $storage->name,
                    'archival_id' => $storage->archival_id,
                    'archival_name' => $storage->archival?->name,
                ];
            });

        return Inertia::render('Admin/Shelves/Index', [
            'rows' => Shelf::query()
                ->with('storage.archival:id,name')
                ->when($archivalId, fn ($query) => $query->whereHas('storage', fn ($storageQuery) => $storageQuery->where('archival_id', $archivalId)))
                ->orderBy('id')
                ->get(['id', 'storage_id', 'code', 'description', 'created_at'])
                ->map(function (Shelf $shelf) {
                    return [
                        'id' => $shelf->id,
                        'storage_id' => $shelf->storage_id,
                        'storage_name' => $shelf->storage?->name,
                        'archival_name' => $shelf->storage?->archival?->name,
                        'code' => $shelf->code,
                        'description' => $shelf->description,
                        'created_at' => $shelf->created_at,
                    ];
                }),
            'storages' => $storages,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'storage_id' => ['required', 'integer', 'exists:storages,id'],
            'code' => ['required', 'string', 'max:255', 'unique:shelves,code'],
            'description' => ['nullable', 'string', 'max:255'],
        ]);

        $shelf = Shelf::create($data);
        $shelf->load('storage.archival:id,name');

        return response()->json([
            'id' => $shelf->id,
            'storage_id' => $shelf->storage_id,
            'storage_name' => $shelf->storage?->name,
            'archival_name' => $shelf->storage?->archival?->name,
            'code' => $shelf->code,
            'description' => $shelf->description,
            'created_at' => $shelf->created_at,
        ]);
    }

    public function update(Request $request, Shelf $shelf): JsonResponse
    {
        $data = $request->validate([
            'field' => ['required', Rule::in(['storage_id', 'code', 'description'])],
            'value' => ['nullable'],
        ]);

        $field = $data['field'];
        $value = $data['value'];

        $rules = match ($field) {
            'storage_id' => ['required', 'integer', 'exists:storages,id'],
            'code' => ['required', 'string', 'max:255', Rule::unique('shelves', 'code')->ignore($shelf->id)],
            'description' => ['nullable', 'string', 'max:255'],
        };

        $request->validate(['value' => $rules]);

        $shelf->{$field} = $value;
        $shelf->save();

        return response()->json(['ok' => true]);
    }

    public function destroy(Shelf $shelf): JsonResponse
    {
        $shelf->delete();

        return response()->json(['ok' => true]);
    }
}
