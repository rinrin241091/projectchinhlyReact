<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\RecordType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class RecordTypeController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin/RecordTypes/Index', [
            'rows' => RecordType::query()
                ->orderBy('id')
                ->get(['id', 'code', 'name', 'description'])
                ->map(function (RecordType $recordType) {
                    return [
                        'id' => $recordType->id,
                        'code' => $recordType->code,
                        'name' => $recordType->name,
                        'description' => $recordType->description,
                    ];
                }),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:255', 'unique:record_types,code'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
        ]);

        $recordType = RecordType::create($data);

        return response()->json([
            'id' => $recordType->id,
            'code' => $recordType->code,
            'name' => $recordType->name,
            'description' => $recordType->description,
        ]);
    }

    public function update(Request $request, RecordType $recordType): JsonResponse
    {
        $data = $request->validate([
            'field' => ['required', Rule::in(['code', 'name', 'description'])],
            'value' => ['nullable'],
        ]);

        $field = $data['field'];
        $value = $data['value'];

        $rules = match ($field) {
            'code' => ['required', 'string', 'max:255', Rule::unique('record_types', 'code')->ignore($recordType->id)],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
        };

        $request->validate(['value' => $rules]);

        $recordType->{$field} = $value;
        $recordType->save();

        return response()->json(['ok' => true]);
    }

    public function destroy(RecordType $recordType): JsonResponse
    {
        $recordType->delete();

        return response()->json(['ok' => true]);
    }
}
