<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ArchiveRecordItem;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ArchiveRecordItemController extends Controller
{
    public function index(): Response
    {
        $selectedOrganizationId = request()->session()->get('admin.organization_id');

        $organizations = Organization::query()
            ->when($selectedOrganizationId, fn ($query) => $query->whereKey($selectedOrganizationId))
            ->orderBy('name')
            ->get(['id', 'name', 'archivals_time']);

        return Inertia::render('Admin/ArchiveRecordItems/Index', [
            'rows' => ArchiveRecordItem::query()
                ->with('organization:id,name,archivals_time')
                ->when($selectedOrganizationId, fn ($query) => $query->where('organization_id', $selectedOrganizationId))
                ->orderBy('id')
                ->get(['id', 'archive_record_item_code', 'organization_id', 'title', 'description', 'document_date'])
                ->map(function (ArchiveRecordItem $item) {
                    return [
                        'id' => $item->id,
                        'archive_record_item_code' => $item->archive_record_item_code,
                        'organization_id' => $item->organization_id,
                        'organization_name' => $item->organization?->name,
                        'year' => $item->organization?->archivals_time,
                        'title' => $item->title,
                        'description' => $item->description,
                        'document_date' => $item->document_date,
                    ];
                }),
            'organizations' => $organizations,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'archive_record_item_code' => ['required', 'string', 'max:255'],
            'organization_id' => ['required', 'integer', 'exists:organizations,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'page_num' => ['nullable', 'integer'],
            'document_date' => ['nullable', 'string', 'max:255'],
        ]);

        $item = ArchiveRecordItem::create($data);
        $item->load('organization:id,name,archivals_time');

        return response()->json([
            'id' => $item->id,
            'archive_record_item_code' => $item->archive_record_item_code,
            'organization_id' => $item->organization_id,
            'organization_name' => $item->organization?->name,
            'year' => $item->organization?->archivals_time,
            'title' => $item->title,
            'description' => $item->description,
            'document_date' => $item->document_date,
        ]);
    }

    public function update(Request $request, ArchiveRecordItem $archiveRecordItem): JsonResponse
    {
        $data = $request->validate([
            'field' => ['required', Rule::in(['archive_record_item_code', 'organization_id', 'title', 'description', 'page_num', 'document_date'])],
            'value' => ['nullable'],
        ]);

        $field = $data['field'];
        $value = $data['value'];

        $rules = match ($field) {
            'archive_record_item_code' => ['required', 'string', 'max:255'],
            'organization_id' => ['required', 'integer', 'exists:organizations,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'page_num' => ['nullable', 'integer'],
            'document_date' => ['nullable', 'string', 'max:255'],
        };

        $request->validate(['value' => $rules]);

        $archiveRecordItem->{$field} = $value;
        $archiveRecordItem->save();

        return response()->json(['ok' => true]);
    }

    public function destroy(ArchiveRecordItem $archiveRecordItem): JsonResponse
    {
        $archiveRecordItem->delete();

        return response()->json(['ok' => true]);
    }
}
