<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Archival;
use App\Models\Organization;
use App\Models\Storage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class StorageController extends Controller
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

        $archivals = Archival::query()
            ->when($archivalId, fn ($query) => $query->where('id', $archivalId))
            ->orderBy('name')
            ->get(['id', 'name']);

        return Inertia::render('Admin/Storages/Index', [
            'rows' => Storage::query()
                ->with('archival:id,name')
                ->when($archivalId, fn ($query) => $query->where('archival_id', $archivalId))
                ->orderBy('id')
                ->get(['id', 'code', 'name', 'location', 'archival_id', 'created_at'])
                ->map(function (Storage $storage) {
                    return [
                        'id' => $storage->id,
                        'code' => $storage->code,
                        'name' => $storage->name,
                        'location' => $storage->location,
                        'created_at' => $storage->created_at,
                        'archival_id' => $storage->archival_id,
                        'archival_name' => $storage->archival?->name,
                    ];
                }),
            'archivals' => $archivals,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'location' => ['nullable', 'string', 'max:255'],
            'archival_id' => ['required', 'integer', 'exists:archivals,id'],
        ]);

        $storage = Storage::create($data);
        $storage->load('archival:id,name');

        return response()->json([
            'id' => $storage->id,
            'code' => $storage->code,
            'name' => $storage->name,
            'location' => $storage->location,
            'created_at' => $storage->created_at,
            'archival_id' => $storage->archival_id,
            'archival_name' => $storage->archival?->name,
        ]);
    }

    public function update(Request $request, Storage $storage): JsonResponse
    {
        $data = $request->validate([
            'field' => ['required', Rule::in(['code', 'name', 'location', 'archival_id'])],
            'value' => ['nullable'],
        ]);

        $field = $data['field'];
        $value = $data['value'];

        $rules = match ($field) {
            'code' => ['required', 'string', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'location' => ['nullable', 'string', 'max:255'],
            'archival_id' => ['required', 'integer', 'exists:archivals,id'],
        };

        $request->validate(['value' => $rules]);

        $storage->{$field} = $value;
        $storage->save();

        return response()->json(['ok' => true]);
    }

    public function destroy(Storage $storage): JsonResponse
    {
        $storage->delete();

        return response()->json(['ok' => true]);
    }
}
