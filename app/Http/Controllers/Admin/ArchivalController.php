<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Archival;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ArchivalController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('Admin/Archives/Index', [
            'rows' => Archival::query()
                ->orderBy('id')
                ->get(['id', 'identifier', 'name', 'address', 'phone', 'email', 'manager']),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'identifier' => ['required', 'string', 'max:20'],
            'name' => ['required', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:20'],
            'email' => ['nullable', 'string', 'max:100'],
            'manager' => ['nullable', 'string', 'max:100'],
        ]);

        $archival = Archival::create($data);

        return response()->json($archival);
    }

    public function update(Request $request, Archival $archival): JsonResponse
    {
        $data = $request->validate([
            'field' => ['required', Rule::in(['identifier', 'name', 'address', 'phone', 'email', 'manager'])],
            'value' => ['nullable'],
        ]);

        $field = $data['field'];
        $value = $data['value'];

        $rules = match ($field) {
            'identifier' => ['required', 'string', 'max:20'],
            'name' => ['required', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:20'],
            'email' => ['nullable', 'string', 'max:100'],
            'manager' => ['nullable', 'string', 'max:100'],
        };

        $request->validate(['value' => $rules]);

        $archival->{$field} = $value;
        $archival->save();

        return response()->json(['ok' => true]);
    }

    public function destroy(Archival $archival): JsonResponse
    {
        $archival->delete();

        return response()->json(['ok' => true]);
    }
}
