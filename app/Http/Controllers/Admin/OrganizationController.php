<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Archival;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class OrganizationController extends Controller
{
    public function index(): Response
    {
        $archivals = Archival::query()
            ->orderBy('name')
            ->get(['id', 'name']);

        return Inertia::render('Admin/Organizations/Index', [
            'rows' => Organization::query()
                ->with('archival:id,name')
                ->orderBy('id')
                ->get(['id', 'code', 'name', 'type', 'archivals_time', 'key_groups', 'created_at', 'archival_id'])
                ->map(function (Organization $organization) {
                    return [
                        'id' => $organization->id,
                        'code' => $organization->code,
                        'name' => $organization->name,
                        'type' => $organization->type,
                        'archivals_time' => $organization->archivals_time,
                        'key_groups' => $organization->key_groups,
                        'created_at' => $organization->created_at,
                        'archival_id' => $organization->archival_id,
                        'archival_name' => $organization->archival?->name,
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
            'type' => ['nullable', 'string', 'max:20'],
            'archivals_time' => ['required', 'string', 'max:255'],
            'key_groups' => ['nullable', 'string'],
            'archival_id' => ['required', 'integer', 'exists:archivals,id'],
        ]);

        $organization = Organization::create([
            'code' => $data['code'],
            'name' => $data['name'],
            'type' => $data['type'] ?? null,
            'archivals_time' => $data['archivals_time'],
            'key_groups' => $data['key_groups'],
            'archival_id' => $data['archival_id'],
        ]);

        $organization->load('archival:id,name');

        return response()->json([
            'id' => $organization->id,
            'code' => $organization->code,
            'name' => $organization->name,
            'type' => $organization->type,
            'archivals_time' => $organization->archivals_time,
            'key_groups' => $organization->key_groups,
            'created_at' => $organization->created_at,
            'archival_id' => $organization->archival_id,
            'archival_name' => $organization->archival?->name,
        ]);
    }

    public function update(Request $request, Organization $organization): JsonResponse
    {
        $data = $request->validate([
            'field' => ['required', Rule::in(['code', 'name', 'type', 'archivals_time', 'key_groups', 'archival_id'])],
            'value' => ['nullable'],
        ]);

        $field = $data['field'];
        $value = $data['value'];

        $rules = match ($field) {
            'code' => ['required', 'string', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'type' => ['nullable', 'string', 'max:20'],
            'archivals_time' => ['required', 'string', 'max:255'],
            'key_groups' => ['nullable', 'string'],
            'archival_id' => ['required', 'integer', 'exists:archivals,id'],
        };

        $request->validate(['value' => $rules]);

        $organization->{$field} = $value;
        $organization->save();

        return response()->json(['ok' => true]);
    }

    public function destroy(Organization $organization): JsonResponse
    {
        $organization->delete();

        return response()->json(['ok' => true]);
    }
}
