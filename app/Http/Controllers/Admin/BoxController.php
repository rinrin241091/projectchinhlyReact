<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Box;
use App\Models\Organization;
use App\Models\Shelf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class BoxController extends Controller
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

        $shelves = Shelf::query()
            ->with('storage.archival:id,name')
            ->when($archivalId, fn ($query) => $query->whereHas('storage', fn ($storageQuery) => $storageQuery->where('archival_id', $archivalId)))
            ->orderBy('code')
            ->get(['id', 'code', 'storage_id'])
            ->map(function (Shelf $shelf) {
                return [
                    'id' => $shelf->id,
                    'code' => $shelf->code,
                    'storage_id' => $shelf->storage_id,
                    'storage_name' => $shelf->storage?->name,
                    'archival_name' => $shelf->storage?->archival?->name,
                ];
            });

        return Inertia::render('Admin/Boxes/Index', [
            'rows' => Box::query()
                ->with('shelf.storage')
                ->when($archivalId, fn ($query) => $query->whereHas('shelf.storage', fn ($storageQuery) => $storageQuery->where('archival_id', $archivalId)))
                ->orderBy('id')
                ->get(['id', 'shelf_id', 'code', 'description', 'created_at'])
                ->map(function (Box $box) {
                    return [
                        'id' => $box->id,
                        'shelf_id' => $box->shelf_id,
                        'shelf_code' => $box->shelf?->code,
                        'storage_name' => $box->shelf?->storage?->name,
                        'code' => $box->code,
                        'description' => $box->description,
                        'created_at' => $box->created_at,
                    ];
                }),
            'shelves' => $shelves,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'shelf_id' => ['required', 'integer', 'exists:shelves,id'],
            'code' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:255'],
            'type' => ['nullable', 'string', 'max:255'],
            'record_count' => ['nullable', 'integer'],
            'page_count' => ['nullable', 'integer'],
            'location' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'string', 'max:255'],
        ]);

        $box = Box::create($data);
        $box->load('shelf.storage');

        return response()->json([
            'id' => $box->id,
            'shelf_id' => $box->shelf_id,
            'shelf_code' => $box->shelf?->code,
            'storage_name' => $box->shelf?->storage?->name,
            'code' => $box->code,
            'description' => $box->description,
            'created_at' => $box->created_at,
        ]);
    }

    public function update(Request $request, Box $box): JsonResponse
    {
        $data = $request->validate([
            'field' => ['required', Rule::in(['shelf_id', 'code', 'description', 'type', 'record_count', 'page_count', 'location', 'status'])],
            'value' => ['nullable'],
        ]);

        $field = $data['field'];
        $value = $data['value'];

        $rules = match ($field) {
            'shelf_id' => ['required', 'integer', 'exists:shelves,id'],
            'code' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:255'],
            'type' => ['nullable', 'string', 'max:255'],
            'record_count' => ['nullable', 'integer'],
            'page_count' => ['nullable', 'integer'],
            'location' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'string', 'max:255'],
        };

        $request->validate(['value' => $rules]);

        $box->{$field} = $value;
        $box->save();

        return response()->json(['ok' => true]);
    }

    public function destroy(Box $box): JsonResponse
    {
        $box->delete();

        return response()->json(['ok' => true]);
    }
}
