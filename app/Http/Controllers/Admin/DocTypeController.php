<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\DocType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class DocTypeController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin/DocTypes/Index', [
            'rows' => DocType::query()
                ->orderBy('id')
                ->get(['id', 'name', 'description'])
                ->map(function (DocType $docType) {
                    return [
                        'id' => $docType->id,
                        'name' => $docType->name,
                        'description' => $docType->description,
                    ];
                }),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:doc_types,name'],
            'description' => ['nullable', 'string', 'max:255'],
        ]);

        $docType = DocType::create($data);

        return response()->json([
            'id' => $docType->id,
            'name' => $docType->name,
            'description' => $docType->description,
        ]);
    }

    public function update(Request $request, DocType $docType): JsonResponse
    {
        $data = $request->validate([
            'field' => ['required', Rule::in(['name', 'description'])],
            'value' => ['nullable'],
        ]);

        $field = $data['field'];
        $value = $data['value'];

        $rules = match ($field) {
            'name' => ['required', 'string', 'max:255', Rule::unique('doc_types', 'name')->ignore($docType->id)],
            'description' => ['nullable', 'string', 'max:255'],
        };

        $request->validate(['value' => $rules]);

        $docType->{$field} = $value;
        $docType->save();

        return response()->json(['ok' => true]);
    }

    public function destroy(DocType $docType): JsonResponse
    {
        $docType->delete();

        return response()->json(['ok' => true]);
    }
}
