<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ArchiveRecord;
use App\Models\ArchiveRecordItem;
use App\Models\DocType;
use App\Models\Document;
use App\Models\Organization;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use ZipArchive;

class DocumentController extends Controller
{
    public function index(): Response
    {
        $docTypes = DocType::query()
            ->orderBy('name')
            ->get(['id', 'name']);

        $selectedOrganizationId = request()->session()->get('admin.organization_id');
        $organizationType = $selectedOrganizationId
            ? Organization::query()->whereKey($selectedOrganizationId)->value('type')
            : null;

        if (! $selectedOrganizationId) {
            return Inertia::render('Admin/Documents/Index', [
                'rows' => [],
                'docTypes' => $docTypes,
                'archiveRecords' => [],
                'items' => [],
                'organizationType' => null,
            ]);
        }

        $items = ArchiveRecordItem::query()
            ->when($selectedOrganizationId, fn ($query) => $query->where('organization_id', $selectedOrganizationId))
            ->orderBy('archive_record_item_code')
            ->get(['id', 'archive_record_item_code', 'title']);

        $itemIds = $selectedOrganizationId ? $items->pluck('id')->all() : null;

        $archiveRecords = ArchiveRecord::query()
            ->leftJoin('boxes', 'boxes.id', '=', 'archive_records.box_id')
            ->leftJoin('shelves', 'shelves.id', '=', 'boxes.shelf_id')
            ->when($itemIds !== null, fn ($query) => $query->whereIn('archive_record_item_id', $itemIds))
            ->orderBy('archive_records.reference_code')
            ->get([
                'archive_records.id',
                'archive_records.code',
                'archive_records.reference_code',
                'archive_records.title',
                'archive_records.archive_record_item_id',
                'archive_records.box_id',
                'boxes.code as box_code',
                'shelves.code as shelf_code',
            ]);

        $recordIds = $selectedOrganizationId ? $archiveRecords->pluck('id')->all() : null;

        return Inertia::render('Admin/Documents/Index', [
            'rows' => [],
            'docTypes' => $docTypes,
            'archiveRecords' => $archiveRecords,
            'items' => $items,
            'organizationType' => $organizationType,
        ]);
    }

    public function rows(Request $request): JsonResponse
    {
        $selectedOrganizationId = $request->session()->get('admin.organization_id');
        $validated = $request->validate([
            'record_id' => ['required', 'integer', 'exists:archive_records,id'],
        ]);

        $recordId = (int) $validated['record_id'];

        $recordQuery = ArchiveRecord::query()->whereKey($recordId);

        if ($selectedOrganizationId) {
            $recordQuery
                ->join('archive_record_items', 'archive_record_items.id', '=', 'archive_records.archive_record_item_id')
                ->where('archive_record_items.organization_id', (int) $selectedOrganizationId);
        }

        abort_unless($recordQuery->exists(), 404, 'Không tìm thấy hồ sơ phù hợp.');

        $rows = Document::query()
            ->leftJoin('users', 'users.id', '=', 'documents.created_by')
            ->where('documents.archive_record_id', $recordId)
            ->orderByRaw('COALESCE(documents.stt, 999999)')
            ->orderBy('documents.id')
            ->get($this->documentSelectColumns());

        return response()->json([
            'rows' => $rows,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'archive_record_id' => ['nullable', 'integer', 'exists:archive_records,id'],
            'stt' => ['nullable', 'integer'],
            'doc_type_id' => ['nullable', 'integer', 'exists:doc_types,id'],
            'document_number' => ['nullable', 'string', 'max:255'],
            'document_symbol' => ['nullable', 'string', 'max:255'],
            'document_code' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'signer' => ['nullable', 'string', 'max:255'],
            'author' => ['nullable', 'string'],
            'security_level' => ['nullable', 'string', 'max:255'],
            'copy_type' => ['nullable', 'string', 'max:255'],
            'page_number' => ['nullable', 'string', 'max:255'],
            'page_number_from' => ['nullable', 'string', 'max:255'],
            'page_number_to' => ['nullable', 'string', 'max:255'],
            'total_pages' => ['nullable', 'integer'],
            'file_count' => ['nullable', 'integer'],
            'file_name' => ['nullable', 'string', 'max:255'],
            'document_duration' => ['nullable', 'string', 'max:255'],
            'usage_mode' => ['nullable', 'string', 'max:255'],
            'keywords' => ['nullable', 'string'],
            'language' => ['nullable', 'string', 'max:255'],
            'handwritten' => ['nullable', 'string', 'max:255'],
            'topic' => ['nullable', 'string', 'max:255'],
            'information_code' => ['nullable', 'string', 'max:255'],
            'reliability_level' => ['nullable', 'string', 'max:255'],
            'physical_condition' => ['nullable', 'string', 'max:255'],
            'document_date' => ['nullable'],
            'document_date_text' => ['nullable', 'string', 'max:255'],
            'document_date_bracketed' => ['nullable', 'boolean'],
            'issuing_agency' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        if (empty($data['doc_type_id'])) {
            $data['doc_type_id'] = DocType::query()->value('id');
        }

        if (empty($data['doc_type_id'])) {
            throw ValidationException::withMessages([
                'doc_type_id' => 'Chưa có loại văn bản. Vui lòng tạo ít nhất 1 loại văn bản.',
            ]);
        }

        if (($data['description'] ?? null) === null) {
            $data['description'] = '';
        }

        $datePayload = $this->normalizeDocumentDateFields(
            $data['document_date'] ?? $data['document_date_text'] ?? null,
            (bool) ($data['document_date_bracketed'] ?? false),
        );
        $data['document_date'] = $datePayload['document_date'];
        $data['document_date_text'] = $datePayload['document_date_text'];
        $data['document_date_bracketed'] = $datePayload['document_date_bracketed'];

        $data['created_by'] = $request->user()?->id;

        $data['total_pages'] = $this->calculateTotalPages(
            $data['page_number_from'] ?? null,
            $data['page_number_to'] ?? null,
            $data['total_pages'] ?? null,
        );

        $document = Document::create($data);
        $creatorName = $request->user()?->name;

        return response()->json(array_merge($document->only([
            'id',
            'archive_record_id',
            'created_by',
            'stt',
            'doc_type_id',
            'document_number',
            'document_symbol',
            'document_code',
            'description',
            'signer',
            'author',
            'security_level',
            'copy_type',
            'page_number',
            'page_number_from',
            'page_number_to',
            'total_pages',
            'file_count',
            'file_name',
            'document_duration',
            'usage_mode',
            'keywords',
            'language',
            'handwritten',
            'topic',
            'information_code',
            'reliability_level',
            'physical_condition',
            'document_date',
            'document_date_text',
            'document_date_bracketed',
            'issuing_agency',
            'note',
            'created_at',
        ]), [
            'created_by_name' => $creatorName,
        ]));
    }

    public function importDang(Request $request): JsonResponse
    {
        $selectedOrganizationId = $request->session()->get('admin.organization_id');

        abort_unless($selectedOrganizationId, 422, 'Vui lòng chọn phông trước khi import file.');

        $organization = Organization::query()
            ->whereKey($selectedOrganizationId)
            ->first(['id', 'name', 'type']);

        abort_unless($organization, 404, 'Không tìm thấy phông đang chọn.');
        abort_unless($organization->type === 'Đảng', 422, 'Chức năng import này chỉ áp dụng cho phông Đảng.');

        $validated = $request->validate([
            'archive_record_id' => ['required', 'integer', 'exists:archive_records,id'],
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv'],
        ]);

        $archiveRecord = ArchiveRecord::query()
            ->join('archive_record_items', 'archive_record_items.id', '=', 'archive_records.archive_record_item_id')
            ->where('archive_records.id', (int) $validated['archive_record_id'])
            ->where('archive_record_items.organization_id', (int) $organization->id)
            ->select(['archive_records.id'])
            ->first();

        abort_unless($archiveRecord, 404, 'Không tìm thấy hồ sơ thuộc phông đang chọn.');

        $defaultDocTypeId = DocType::query()->value('id');
        if (! $defaultDocTypeId) {
            throw ValidationException::withMessages([
                'file' => 'Chưa có loại văn bản. Vui lòng tạo ít nhất 1 loại văn bản trước khi import.',
            ]);
        }

        $spreadsheet = IOFactory::load($validated['file']->getRealPath());
        $sheet = $spreadsheet->getSheet(0);

        [$headerRow, $columnMap] = $this->detectDangImportHeader($sheet);

        $highestRow = $sheet->getHighestDataRow();
        $createdIds = [];
        $nextStt = $this->getNextDocumentSttForRecord((int) $archiveRecord->id);
        $emptyRowCount = 0;

        for ($row = $headerRow + 1; $row <= $highestRow; $row++) {
            $rowData = $this->extractDangImportRow($sheet, $row, $columnMap);

            if (! $rowData['has_content']) {
                $emptyRowCount++;
                if ($emptyRowCount >= 10) {
                    break;
                }
                continue;
            }

            $emptyRowCount = 0;

            $datePayload = $this->normalizeDocumentDateFields(
                $rowData['document_date'],
                false,
            );

            $document = Document::create([
                'archive_record_id' => (int) $archiveRecord->id,
                'created_by' => $request->user()?->id,
                'stt' => $rowData['stt'] ?? $nextStt,
                'doc_type_id' => $defaultDocTypeId,
                'document_number' => null,
                'document_symbol' => null,
                'document_code' => $rowData['document_code'],
                'description' => $rowData['description'],
                'signer' => $rowData['signer'],
                'author' => $rowData['issuing_agency'],
                'security_level' => $rowData['security_level'],
                'copy_type' => $rowData['copy_type'],
                'page_number' => $rowData['page_number'],
                'page_number_from' => $rowData['page_number_from'],
                'page_number_to' => $rowData['page_number_to'],
                'total_pages' => $rowData['total_pages'],
                'file_count' => 1,
                'file_name' => null,
                'document_duration' => null,
                'usage_mode' => null,
                'keywords' => $this->extractDangImportKeywords($rowData['description']),
                'language' => null,
                'handwritten' => null,
                'topic' => null,
                'information_code' => null,
                'reliability_level' => null,
                'physical_condition' => null,
                'document_date' => $datePayload['document_date'],
                'document_date_text' => $datePayload['document_date_text'],
                'document_date_bracketed' => $datePayload['document_date_bracketed'],
                'issuing_agency' => $rowData['issuing_agency'],
                'note' => $rowData['note'],
            ]);

            $createdIds[] = $document->id;
            $nextStt = max($nextStt, (int) ($rowData['stt'] ?? $nextStt)) + 1;
        }

        if (empty($createdIds)) {
            throw ValidationException::withMessages([
                'file' => 'Không tìm thấy dòng dữ liệu hợp lệ để import.',
            ]);
        }

        $createdRows = Document::query()
            ->leftJoin('users', 'users.id', '=', 'documents.created_by')
            ->whereIn('documents.id', $createdIds)
            ->orderBy('documents.archive_record_id')
            ->orderByRaw('COALESCE(documents.stt, 999999)')
            ->orderBy('documents.id')
            ->get($this->documentSelectColumns());

        return response()->json([
            'ok' => true,
            'count' => count($createdIds),
            'rows' => $createdRows,
        ]);
    }

    public function update(Request $request, Document $document): JsonResponse
    {
        $this->ensureCanWriteDocument($request, $document);

        $data = $request->validate([
            'field' => [
                'required',
                Rule::in([
                    'archive_record_id',
                    'stt',
                    'doc_type_id',
                    'document_number',
                    'document_symbol',
                    'document_code',
                    'description',
                    'signer',
                    'author',
                    'security_level',
                    'copy_type',
                    'page_number',
                    'page_number_from',
                    'page_number_to',
                    'total_pages',
                    'file_count',
                    'file_name',
                    'document_duration',
                    'usage_mode',
                    'keywords',
                    'language',
                    'handwritten',
                    'topic',
                    'information_code',
                    'reliability_level',
                    'physical_condition',
                    'document_date',
                    'document_date_text',
                    'document_date_bracketed',
                    'issuing_agency',
                    'note',
                ]),
            ],
            'value' => ['nullable'],
        ]);

        $field = $data['field'];
        $value = $data['value'] ?? null;

        $rules = match ($field) {
            'archive_record_id' => ['nullable', 'integer', 'exists:archive_records,id'],
            'stt' => ['nullable', 'integer'],
            'doc_type_id' => ['required', 'integer', 'exists:doc_types,id'],
            'document_number' => ['nullable', 'string', 'max:255'],
            'document_symbol' => ['nullable', 'string', 'max:255'],
            'document_code' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'signer' => ['nullable', 'string', 'max:255'],
            'author' => ['nullable', 'string'],
            'security_level' => ['nullable', 'string', 'max:255'],
            'copy_type' => ['nullable', 'string', 'max:255'],
            'page_number' => ['nullable', 'string', 'max:255'],
            'page_number_from' => ['nullable', 'string', 'max:255'],
            'page_number_to' => ['nullable', 'string', 'max:255'],
            'total_pages' => ['nullable', 'integer'],
            'file_count' => ['nullable', 'integer'],
            'file_name' => ['nullable', 'string', 'max:255'],
            'document_duration' => ['nullable', 'string', 'max:255'],
            'usage_mode' => ['nullable', 'string', 'max:255'],
            'keywords' => ['nullable', 'string'],
            'language' => ['nullable', 'string', 'max:255'],
            'handwritten' => ['nullable', 'string', 'max:255'],
            'topic' => ['nullable', 'string', 'max:255'],
            'information_code' => ['nullable', 'string', 'max:255'],
            'reliability_level' => ['nullable', 'string', 'max:255'],
            'physical_condition' => ['nullable', 'string', 'max:255'],
            'document_date' => ['nullable'],
            'document_date_text' => ['nullable', 'string', 'max:255'],
            'document_date_bracketed' => ['nullable', 'boolean'],
            'issuing_agency' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string', 'max:255'],
        };

        $request->validate(['value' => $rules]);

        if ($field === 'description' && $value === null) {
            $value = '';
        }

        if ($field === 'document_date') {
            $datePayload = $this->normalizeDocumentDateFields(
                $value ?? $request->input('document_date_text'),
                (bool) $request->boolean('document_date_bracketed', $document->document_date_bracketed),
            );
            $document->document_date = $datePayload['document_date'];
            $document->document_date_text = $datePayload['document_date_text'];
            $document->document_date_bracketed = $datePayload['document_date_bracketed'];
        } elseif ($field === 'document_date_bracketed') {
            $document->document_date_bracketed = (bool) $value;
            if (! $document->document_date_bracketed) {
                $document->document_date_text = null;
            } elseif ($document->document_date && blank($document->document_date_text)) {
                $document->document_date_text = $this->formatDateForExport($document->document_date);
            }
        } else {
            $document->{$field} = $value;
        }

        if (in_array($field, ['page_number_from', 'page_number_to', 'total_pages'], true)) {
            $document->total_pages = $this->calculateTotalPages(
                $document->page_number_from,
                $document->page_number_to,
                $document->total_pages,
            );
        }
        $document->save();

        return response()->json(['ok' => true]);
    }

    public function destroy(Request $request, Document $document): JsonResponse
    {
        $this->ensureCanWriteDocument($request, $document);

        $document->delete();

        return response()->json(['ok' => true]);
    }

    private function ensureCanWriteDocument(Request $request, Document $document): void
    {
        $user = $request->user();

        if (! $user) {
            abort(403);
        }

        $normalizedRole = Str::of((string) $user->role)
            ->trim()
            ->lower()
            ->ascii()
            ->replaceMatches('/[^a-z0-9]+/', '_')
            ->trim('_')
            ->toString();

        if ($normalizedRole === 'admin' || $normalizedRole === 'super_admin') {
            return;
        }

        if ($normalizedRole === 'nhap_lieu' && (int) $document->created_by === (int) $user->id) {
            return;
        }

        abort(403, 'Bạn không có quyền sửa tài liệu của người dùng khác.');
    }

    public function exportDang(Request $request): BinaryFileResponse
    {
        $selectedOrganizationId = $request->session()->get('admin.organization_id');

        abort_unless($selectedOrganizationId, 422, 'Vui lòng chọn phông trước khi xuất file.');

        $organization = Organization::query()
            ->whereKey($selectedOrganizationId)
            ->first(['id', 'name', 'type']);

        abort_unless($organization, 404, 'Không tìm thấy phông đang chọn.');
        abort_unless($organization->type === 'Đảng', 422, 'Chức năng này chỉ áp dụng cho phông Đảng.');

        $items = ArchiveRecordItem::query()
            ->where('organization_id', $organization->id)
            ->get(['id']);

        $itemIds = $items->pluck('id')->all();

        $records = ArchiveRecord::query()
            ->whereIn('archive_record_item_id', $itemIds)
            ->orderBy('reference_code')
            ->get(['id', 'code', 'reference_code', 'title']);

        abort_if($records->isEmpty(), 422, 'Phông đang chọn chưa có hồ sơ để xuất.');

        $documentsByRecordId = Document::query()
            ->whereIn('archive_record_id', $records->pluck('id')->all())
            ->orderByRaw('COALESCE(stt, 999999), id')
            ->get([
                'archive_record_id',
                'stt',
                'document_number',
                'document_symbol',
                'document_code',
                'document_date',
                'document_date_text',
                'document_date_bracketed',
                'description',
                'author',
                'issuing_agency',
                'signer',
                'security_level',
                'copy_type',
                'page_number',
                'page_number_from',
                'page_number_to',
                'total_pages',
                'keywords',
                'note',
                'file_count',
                'file_name',
            ])
            ->groupBy('archive_record_id');

        $tempDir = storage_path('app/tmp/document-exports/' . Str::uuid());
        File::ensureDirectoryExists($tempDir);

        $zipFileName = 'Danh-sach-tai-lieu-' . Str::slug($organization->name ?: 'phong') . '-' . now()->format('Ymd_His') . '.zip';
        $zipPath = $tempDir . DIRECTORY_SEPARATOR . $zipFileName;

        $zip = new ZipArchive();
        $openResult = $zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        abort_unless($openResult === true, 500, 'Không thể tạo file zip.');

        foreach ($records as $record) {
            $recordDocuments = $documentsByRecordId->get($record->id, collect());
            $xlsxPath = $tempDir . DIRECTORY_SEPARATOR . Str::uuid() . '.xlsx';
            $recordCodeForFile = trim((string) ($record->code ?? '')) ?: (string) ($record->reference_code ?? '');
            $entryName = $this->buildDangEntryName(
                $recordCodeForFile,
                (string) ($record->title ?? 'Ho-so')
            );

            $this->buildDangWorkbook($record, $recordDocuments, $xlsxPath);
            $zip->addFile($xlsxPath, $entryName);
        }

        $zip->close();

        app()->terminating(function () use ($tempDir): void {
            if (is_dir($tempDir)) {
                File::deleteDirectory($tempDir);
            }
        });

        return response()->download($zipPath, $zipFileName)->deleteFileAfterSend(true);
    }

    public function exportDangRecord(Request $request): BinaryFileResponse
    {
        $selectedOrganizationId = $request->session()->get('admin.organization_id');

        abort_unless($selectedOrganizationId, 422, 'Vui lòng chọn phông trước khi xuất file.');

        $organization = Organization::query()
            ->whereKey($selectedOrganizationId)
            ->first(['id', 'name', 'type']);

        abort_unless($organization, 404, 'Không tìm thấy phông đang chọn.');
        abort_unless($organization->type === 'Đảng', 422, 'Chức năng này chỉ áp dụng cho phông Đảng.');

        $validated = $request->validate([
            'record_id' => ['required', 'integer', 'exists:archive_records,id'],
        ]);

        $record = ArchiveRecord::query()
            ->join('archive_record_items', 'archive_record_items.id', '=', 'archive_records.archive_record_item_id')
            ->where('archive_records.id', (int) $validated['record_id'])
            ->where('archive_record_items.organization_id', (int) $organization->id)
            ->select([
                'archive_records.id',
                'archive_records.code',
                'archive_records.reference_code',
                'archive_records.title',
            ])
            ->first();

        abort_unless($record, 404, 'Không tìm thấy hồ sơ thuộc phông đang chọn.');

        $documents = Document::query()
            ->where('archive_record_id', (int) $record->id)
            ->orderByRaw('COALESCE(stt, 999999), id')
            ->get([
                'archive_record_id',
                'stt',
                'document_number',
                'document_symbol',
                'document_code',
                'document_date',
                'document_date_text',
                'document_date_bracketed',
                'description',
                'author',
                'issuing_agency',
                'signer',
                'security_level',
                'copy_type',
                'page_number',
                'page_number_from',
                'page_number_to',
                'total_pages',
                'keywords',
                'note',
                'file_count',
                'file_name',
            ]);

        $tempDir = storage_path('app/tmp/document-exports/' . Str::uuid());
        File::ensureDirectoryExists($tempDir);

        $recordCodeForFile = trim((string) ($record->code ?? '')) ?: (string) ($record->reference_code ?? '');
        $downloadFileName = $this->buildDangEntryName(
            $recordCodeForFile,
            (string) ($record->title ?? 'Ho-so')
        );
        $xlsxPath = $tempDir . DIRECTORY_SEPARATOR . $downloadFileName;

        $this->buildDangWorkbook($record, $documents, $xlsxPath);

        app()->terminating(function () use ($tempDir): void {
            if (is_dir($tempDir)) {
                File::deleteDirectory($tempDir);
            }
        });

        return response()->download($xlsxPath, $downloadFileName)->deleteFileAfterSend(true);
    }

    private function calculateTotalPages(mixed $fromValue, mixed $toValue, mixed $fallback = null): ?int
    {
        $from = $this->parseSheetNumber($fromValue);
        $to = $this->parseSheetNumber($toValue);

        if ($from !== null && $to !== null) {
            return $to >= $from ? ($to - $from + 1) : null;
        }

        return is_numeric($fallback) ? (int) $fallback : null;
    }

    private function getNextDocumentSttForRecord(int $archiveRecordId): int
    {
        return (int) Document::query()
            ->where('archive_record_id', $archiveRecordId)
            ->max('stt') + 1;
    }

    private function parseSheetNumber(mixed $value): ?int
    {
        if ($value === null) {
            return null;
        }

        $stringValue = trim((string) $value);
        if ($stringValue === '' || !preg_match('/^\d+$/', $stringValue)) {
            return null;
        }

        return (int) $stringValue;
    }

    private function getDisplayPageCountForExport(Document $document): string|int
    {
        if (is_numeric($document->total_pages)) {
            return max(0, (int) $document->total_pages);
        }

        $manualPageCount = trim((string) ($document->page_number ?? ''));
        $manualNumeric = $this->parseSheetNumber($manualPageCount);
        if ($manualNumeric !== null) {
            return $manualNumeric;
        }

        $computed = $this->calculateTotalPages(
            $document->page_number_from,
            $document->page_number_to,
            null,
        );

        return $computed ?? '';
    }

    private function buildDangEntryName(string $referenceCode, string $title): string
    {
        $safeTitle = preg_replace('/[\\\\\\/:*?"<>|]+/u', '_', trim($title)) ?: 'Ho-so';
        $safeCode = preg_replace('/[\\\\\\/:*?"<>|]+/u', '_', trim($referenceCode)) ?: 'NA';

        return "{$safeCode}_{$safeTitle}.xlsx";
    }

    private function buildDangWorkbook(ArchiveRecord $record, Collection $documents, string $targetPath): void
    {
        $spreadsheet = new Spreadsheet();
        $spreadsheet->getDefaultStyle()->getFont()->setName('Times New Roman')->setSize(12);
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle($this->makeSheetTitle($record->reference_code));

        $sheet->mergeCells('N1:O1');
        $sheet->setCellValue('N1', 'Phụ lục số 01');
        $sheet->getStyle('N1')->getFont()->setItalic(true);
        $sheet->getStyle('N1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);

        $sheet->mergeCells('A2:O2');
        $sheet->setCellValue('A2', 'MỤC LỤC TÀI LIỆU');
        $sheet->getStyle('A2')->getFont()->setBold(true)->setSize(16);
        $sheet->getStyle('A2')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        $sheet->mergeCells('A4:O4');
        $sheet->mergeCells('A5:O5');
        $sheet->setCellValue('A4', 'Mã hồ sơ:');
        $sheet->setCellValue('A5', 'Tên hồ sơ:');
        $sheet->getStyle('A4:A5')->getFont()->setBold(true);

        $headers = [
            'A7' => 'Số TT',
            'B7' => 'Số, ký hiệu',
            'C7' => 'Ngày tháng',
            'D7' => 'Tên loại và trích yếu',
            'E7' => 'Tác giả',
            'F7' => 'Người ký',
            'G7' => 'Độ mật',
            'H7' => 'Loại bản',
            'I7' => 'Trang số',
            'J7' => 'Số trang',
            'K7' => 'Từ khóa',
            'L7' => 'Ghi chú',
            'M7' => 'Số lượng tệp (file)',
            'N7' => 'Tên tệp tài liệu',
        ];

        foreach ($headers as $cell => $headerText) {
            $sheet->setCellValue($cell, $headerText);
        }

        $sheet->getStyle('A7:N7')->getFont()->setBold(true);
        $sheet->getStyle('A7:N7')->getAlignment()
            ->setHorizontal(Alignment::HORIZONTAL_CENTER)
            ->setVertical(Alignment::VERTICAL_CENTER)
            ->setWrapText(true);
        $sheet->getRowDimension(7)->setRowHeight(44);

        $sheet->getColumnDimension('A')->setWidth(8);
        $sheet->getColumnDimension('B')->setWidth(16);
        $sheet->getColumnDimension('C')->setWidth(14);
        $sheet->getColumnDimension('D')->setWidth(34);
        $sheet->getColumnDimension('E')->setWidth(18);
        $sheet->getColumnDimension('F')->setWidth(16);
        $sheet->getColumnDimension('G')->setWidth(12);
        $sheet->getColumnDimension('H')->setWidth(12);
        $sheet->getColumnDimension('I')->setWidth(12);
        $sheet->getColumnDimension('J')->setWidth(10);
        $sheet->getColumnDimension('K')->setWidth(14);
        $sheet->getColumnDimension('L')->setWidth(16);
        $sheet->getColumnDimension('M')->setWidth(16);
        $sheet->getColumnDimension('N')->setWidth(24);

        $row = 8;
        $serial = 1;
        foreach ($documents->values() as $document) {
            $pageFrom = trim((string) ($document->page_number_from ?? ''));
            $pageTo = trim((string) ($document->page_number_to ?? ''));
            $pageRange = '';
            if ($pageFrom !== '' || $pageTo !== '') {
                if ($pageFrom !== '' && $pageTo !== '') {
                    $pageRange = "{$pageFrom}-{$pageTo}";
                } else {
                    $singlePage = $pageFrom !== '' ? $pageFrom : $pageTo;
                    $pageRange = "{$singlePage}-{$singlePage}";
                }
            } else {
                $pageRange = trim((string) ($document->page_number ?? ''));
            }

            $displayPageCount = $this->getDisplayPageCountForExport($document);

            $sheet->setCellValue("A{$row}", $serial);
            $sheet->setCellValue("B{$row}", $document->document_code ?: trim(($document->document_number ?? '') . '/' . ($document->document_symbol ?? ''), '/'));
            $sheet->setCellValue("C{$row}", $this->formatDocumentDateForExport($document));
            $sheet->setCellValue("D{$row}", (string) ($document->description ?? ''));
            $sheet->setCellValue("E{$row}", (string) ($document->issuing_agency ?? $document->author ?? ''));
            $sheet->setCellValue("F{$row}", (string) ($document->signer ?? ''));
            $sheet->setCellValue("G{$row}", (string) ($document->security_level ?: 'Thường'));
            $sheet->setCellValue("H{$row}", (string) ($document->copy_type ?: 'Bản chính'));
            $sheet->setCellValue("G{$row}", $this->formatSecurityLevelForExport($document->security_level));
            $sheet->setCellValue("I{$row}", $pageRange);
            $sheet->setCellValue("J{$row}", $displayPageCount);
            $sheet->setCellValue("K{$row}", (string) ($document->keywords ?? ''));
            $sheet->setCellValue("L{$row}", (string) ($document->note ?? ''));
            $sheet->setCellValue("M{$row}", $document->file_count ?: 1);
            $sheet->setCellValue("N{$row}", (string) ($document->file_name ?? ''));
            $row++;
            $serial++;
        }

        $lastDataRow = max($row - 1, 12);

        $sheet->getStyle("A7:N{$lastDataRow}")
            ->getBorders()
            ->getAllBorders()
            ->setBorderStyle(Border::BORDER_THIN);

        $sheet->getStyle("A8:N{$lastDataRow}")
            ->getAlignment()
            ->setVertical(Alignment::VERTICAL_TOP);
        $sheet->getStyle("D8:D{$lastDataRow}")
            ->getAlignment()
            ->setWrapText(true);

        for ($r = 8; $r <= $lastDataRow; $r++) {
            $sheet->getRowDimension($r)->setRowHeight(30);
        }

        $writer = new Xlsx($spreadsheet);
        $writer->save($targetPath);
        $spreadsheet->disconnectWorksheets();
    }

    private function makeSheetTitle(?string $referenceCode): string
    {
        $base = trim((string) $referenceCode);
        if ($base === '') {
            $base = 'HoSo';
        }

        $safe = preg_replace('/[\\\\\\/*?:\\[\\]]+/', '_', $base) ?: 'HoSo';

        return mb_substr($safe, 0, 31);
    }

    /**
     * @return array{0:int,1:array<string,int>}
     */
    private function detectDangImportHeader(\PhpOffice\PhpSpreadsheet\Worksheet\Worksheet $sheet): array
    {
        $highestRow = min($sheet->getHighestDataRow(), 50);
        $highestColumnIndex = Coordinate::columnIndexFromString($sheet->getHighestDataColumn());
        $requiredFields = ['stt', 'document_code', 'document_date', 'description'];

        for ($row = 1; $row <= $highestRow; $row++) {
            $map = [];

            for ($column = 1; $column <= $highestColumnIndex; $column++) {
                $rawValue = (string) $sheet->getCell([$column, $row])->getFormattedValue();
                $normalized = $this->normalizeDangImportHeader($rawValue);

                if ($normalized === '') {
                    continue;
                }

                $field = match (true) {
                    str_contains($normalized, 'stt') => 'stt',
                    str_contains($normalized, 'sokyhieu') => 'document_code',
                    str_contains($normalized, 'ngaythang') => 'document_date',
                    str_contains($normalized, 'tenloaivatrichyeu') => 'description',
                    str_contains($normalized, 'tacgia') => 'issuing_agency',
                    str_contains($normalized, 'nguoiky') => 'signer',
                    str_contains($normalized, 'bangocbanchinh') => 'copy_type_original',
                    str_contains($normalized, 'bansao') => 'copy_type_copy',
                    str_contains($normalized, 'domat') => 'security_level',
                    str_contains($normalized, 'trangso') => 'page_range',
                    str_contains($normalized, 'sotrang') => 'total_pages',
                    str_contains($normalized, 'ghichu') => 'note',
                    default => null,
                };

                if ($field !== null && ! isset($map[$field])) {
                    $map[$field] = $column;
                }
            }

            $hasAllRequired = collect($requiredFields)->every(fn ($field) => isset($map[$field]));
            if ($hasAllRequired) {
                return [$row, $map];
            }
        }

        throw ValidationException::withMessages([
            'file' => 'Không nhận diện được dòng tiêu đề import. Vui lòng dùng đúng mẫu cột tài liệu phông Đảng.',
        ]);
    }

    private function normalizeDangImportHeader(string $value): string
    {
        return Str::of($value)
            ->ascii()
            ->lower()
            ->replace([' ', "\n", "\r", "\t", ',', '.', ':', ';', '-', '_', '/', '\\', '(', ')'], '')
            ->toString();
    }

    /**
     * @param  array<string,int>  $columnMap
     * @return array{
     *     has_content: bool,
     *     stt: int|null,
     *     document_code: string|null,
     *     document_date: string|null,
     *     description: string,
     *     issuing_agency: string|null,
     *     signer: string|null,
     *     copy_type: string|null,
     *     security_level: string,
     *     page_number: string|null,
     *     page_number_from: string|null,
     *     page_number_to: string|null,
     *     total_pages: int|null,
     *     note: string|null
     * }
     */
    private function extractDangImportRow(\PhpOffice\PhpSpreadsheet\Worksheet\Worksheet $sheet, int $row, array $columnMap): array
    {
        $rawStt = $this->getDangImportCellValue($sheet, $row, $columnMap['stt'] ?? null);
        $rawDocumentCode = $this->getDangImportCellValue($sheet, $row, $columnMap['document_code'] ?? null);
        $rawDocumentDate = $this->getDangImportCellValue($sheet, $row, $columnMap['document_date'] ?? null);
        $rawDescription = $this->getDangImportCellValue($sheet, $row, $columnMap['description'] ?? null);
        $rawIssuingAgency = $this->getDangImportCellValue($sheet, $row, $columnMap['issuing_agency'] ?? null);
        $rawSigner = $this->getDangImportCellValue($sheet, $row, $columnMap['signer'] ?? null);
        $rawOriginalMark = $this->getDangImportCellValue($sheet, $row, $columnMap['copy_type_original'] ?? null);
        $rawCopyMark = $this->getDangImportCellValue($sheet, $row, $columnMap['copy_type_copy'] ?? null);
        $rawSecurityLevel = $this->getDangImportCellValue($sheet, $row, $columnMap['security_level'] ?? null);
        $rawPageRange = $this->getDangImportCellValue($sheet, $row, $columnMap['page_range'] ?? null);
        $rawTotalPages = $this->getDangImportCellValue($sheet, $row, $columnMap['total_pages'] ?? null);
        $rawNote = $this->getDangImportCellValue($sheet, $row, $columnMap['note'] ?? null);

        $hasContent = collect([
            $rawStt,
            $rawDocumentCode,
            $rawDocumentDate,
            $rawDescription,
            $rawIssuingAgency,
            $rawSigner,
            $rawPageRange,
            $rawTotalPages,
            $rawNote,
        ])->contains(fn ($value) => trim((string) $value) !== '');

        [$pageFrom, $pageTo] = $this->extractDangImportPageRange($rawPageRange);

        return [
            'has_content' => $hasContent,
            'stt' => is_numeric($rawStt) ? (int) $rawStt : null,
            'document_code' => $this->normalizeDangImportText($rawDocumentCode),
            'document_date' => $this->normalizeDangImportDateValue($rawDocumentDate),
            'description' => $this->normalizeDangImportText($rawDescription) ?? '',
            'issuing_agency' => $this->normalizeDangImportText($rawIssuingAgency),
            'signer' => $this->normalizeDangImportText($rawSigner),
            'copy_type' => $this->normalizeDangImportCopyType($rawOriginalMark, $rawCopyMark),
            'security_level' => $this->normalizeDangImportSecurityLevel($rawSecurityLevel),
            'page_number' => $this->normalizeDangImportText($rawTotalPages),
            'page_number_from' => $pageFrom,
            'page_number_to' => $pageTo,
            'total_pages' => is_numeric(trim((string) $rawTotalPages)) ? (int) trim((string) $rawTotalPages) : null,
            'note' => $this->normalizeDangImportText($rawNote),
        ];
    }

    private function getDangImportCellValue(\PhpOffice\PhpSpreadsheet\Worksheet\Worksheet $sheet, int $row, ?int $column): ?string
    {
        if (! $column) {
            return null;
        }

        $value = (string) $sheet->getCell([$column, $row])->getFormattedValue();
        $normalized = trim(preg_replace('/\s+/u', ' ', str_replace(["\r", "\n"], ' ', $value)) ?? '');

        return $normalized === '' ? null : $normalized;
    }

    private function normalizeDangImportText(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = trim(preg_replace('/\s+/u', ' ', str_replace(["\r", "\n"], ' ', $value)) ?? '');

        return $normalized === '' ? null : $normalized;
    }

    private function normalizeDangImportDateValue(?string $value): ?string
    {
        $text = $this->normalizeDangImportText($value);
        if ($text === null) {
            return null;
        }

        if (preg_match('/^\d{1,2}\/\d{1,2}\/\d{4}$/', $text)) {
            return $text;
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $text)) {
            return $text;
        }

        return $text;
    }

    /**
     * @return array{0:string|null,1:string|null}
     */
    private function extractDangImportPageRange(?string $value): array
    {
        $text = $this->normalizeDangImportText($value);
        if ($text === null) {
            return [null, null];
        }

        $normalized = preg_replace('/\s+/u', '', $text) ?? '';
        if ($normalized === '') {
            return [null, null];
        }

        if (str_contains($normalized, '-')) {
            [$from, $to] = array_pad(explode('-', $normalized, 2), 2, null);
            return [
                $from !== null && $from !== '' ? $from : null,
                $to !== null && $to !== '' ? $to : null,
            ];
        }

        return [$normalized, $normalized];
    }

    private function normalizeDangImportCopyType(?string $originalMark, ?string $copyMark): ?string
    {
        $original = Str::lower(trim((string) $originalMark));
        $copy = Str::lower(trim((string) $copyMark));

        if ($copy === 'x') {
            return 'Bản sao';
        }

        if ($original === 'x') {
            return 'Bản chính';
        }

        return null;
    }

    private function normalizeDangImportSecurityLevel(?string $value): string
    {
        $text = $this->normalizeDangImportText($value);
        if ($text === null) {
            return 'Thường';
        }

        $normalized = Str::of($text)
            ->ascii()
            ->lower()
            ->replaceMatches('/\s+/', ' ')
            ->trim()
            ->toString();

        return match ($normalized) {
            'mat' => 'Mật',
            'tuyet mat' => 'Tuyệt mật',
            'toi mat' => 'Tối mật',
            default => 'Thường',
        };
    }

    private function extractDangImportKeywords(string $description): ?string
    {
        $normalized = trim(preg_replace('/\s+/u', ' ', $description) ?? '');
        if ($normalized === '') {
            return null;
        }

        $words = preg_split('/\s+/u', $normalized, -1, PREG_SPLIT_NO_EMPTY);
        if (! is_array($words) || empty($words)) {
            return null;
        }

        return implode(' ', array_slice($words, 0, 2));
    }

    private function formatSecurityLevelForExport(?string $value): string
    {
        $original = trim((string) $value);
        if ($original === '') {
            return 'Thường';
        }

        $normalized = Str::of($original)
            ->lower()
            ->ascii()
            ->replaceMatches('/\s+/', ' ')
            ->trim()
            ->toString();

        return match ($normalized) {
            'thuong' => 'Thường',
            'mat' => 'Mật',
            'tuyet mat' => 'Tuyệt mật',
            'toi mat' => 'Tối mật',
            default => mb_convert_case($original, MB_CASE_TITLE, 'UTF-8'),
        };
    }

    /**
     * @return array{document_date: string|null, document_date_text: string|null, document_date_bracketed: bool}
     */
    private function normalizeDocumentDateFields(mixed $value, bool $allowYearOnly): array
    {
        $rawValue = is_string($value) || is_numeric($value)
            ? trim((string) $value)
            : '';

        if ($rawValue === '') {
            return [
                'document_date' => null,
                'document_date_text' => null,
                'document_date_bracketed' => $allowYearOnly,
            ];
        }

        if (preg_match('/^\d{4}$/', $rawValue)) {
            if (! $allowYearOnly) {
                throw ValidationException::withMessages([
                    'value' => 'Ngày tháng phải theo định dạng dd/mm/yyyy hoặc yyyy-mm-dd.',
                ]);
            }

            return [
                'document_date' => null,
                'document_date_text' => $rawValue,
                'document_date_bracketed' => true,
            ];
        }

        $date = $this->parseFlexibleDate($rawValue);
        if (! $date) {
            throw ValidationException::withMessages([
                'value' => 'Ngày tháng phải theo định dạng dd/mm/yyyy hoặc yyyy-mm-dd.',
            ]);
        }

        return [
            'document_date' => $date,
            'document_date_text' => $allowYearOnly ? $this->formatDateForExport($date) : null,
            'document_date_bracketed' => $allowYearOnly,
        ];
    }

    private function parseFlexibleDate(string $value): ?string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return null;
        }

        if (preg_match('/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/', $trimmed, $matches)) {
            $day = (int) $matches[1];
            $month = (int) $matches[2];
            $year = (int) $matches[3];

            if (! checkdate($month, $day, $year)) {
                return null;
            }

            return sprintf('%04d-%02d-%02d', $year, $month, $day);
        }

        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $trimmed, $matches)) {
            $year = (int) $matches[1];
            $month = (int) $matches[2];
            $day = (int) $matches[3];

            if (! checkdate($month, $day, $year)) {
                return null;
            }

            return sprintf('%04d-%02d-%02d', $year, $month, $day);
        }

        try {
            return \Illuminate\Support\Carbon::parse($trimmed)->format('Y-m-d');
        } catch (\Throwable) {
            // ignore
        }

        return null;
    }

    private function formatDocumentDateForExport(mixed $document): string
    {
        $displayValue = trim((string) ($document->document_date_text ?? ''));
        if ($displayValue === '') {
            $displayValue = $this->formatDateForExport($document->document_date ?? null);
        }

        if ((bool) ($document->document_date_bracketed ?? false)) {
            return '[' . $displayValue . ']';
        }

        return $displayValue;
    }

    private function formatDateForExport(mixed $value): string
    {
        if (!$value) {
            return '';
        }

        try {
            return \Illuminate\Support\Carbon::parse($value)->format('d/m/Y');
        } catch (\Throwable) {
            return (string) $value;
        }
    }

    public function exportRecord(Request $request): BinaryFileResponse
    {
        $selectedOrganizationId = $request->session()->get('admin.organization_id');
        abort_unless($selectedOrganizationId, 422, 'Vui lòng chọn phông trước khi xuất file.');

        $validated = $request->validate([
            'record_id' => ['required', 'integer', 'exists:archive_records,id'],
        ]);

        $record = ArchiveRecord::query()
            ->join('archive_record_items', 'archive_record_items.id', '=', 'archive_records.archive_record_item_id')
            ->where('archive_records.id', (int) $validated['record_id'])
            ->where('archive_record_items.organization_id', (int) $selectedOrganizationId)
            ->select(['archive_records.id', 'archive_records.code', 'archive_records.reference_code', 'archive_records.title'])
            ->first();

        abort_unless($record, 404, 'Không tìm thấy hồ sơ thuộc phông đang chọn.');

        $documents = Document::query()
            ->where('archive_record_id', (int) $record->id)
            ->orderByRaw('COALESCE(stt, 999999), id')
            ->get();

        $tempDir = storage_path('app/tmp/document-exports/' . Str::uuid());
        File::ensureDirectoryExists($tempDir);

        $recordCode = trim((string) ($record->code ?? $record->reference_code ?? ''));
        $safeCode = preg_replace('/[\\\\\\/:*?"<>|]+/u', '_', $recordCode) ?: 'Ho-so';
        $safeTitle = preg_replace('/[\\\\\\/:*?"<>|]+/u', '_', trim((string) ($record->title ?? ''))) ?: 'Ho-so';
        $fileName = "{$safeCode}_{$safeTitle}.xlsx";
        $xlsxPath = $tempDir . DIRECTORY_SEPARATOR . $fileName;

        $this->buildGenericWorkbook($record, $documents, $xlsxPath);

        app()->terminating(function () use ($tempDir): void {
            if (is_dir($tempDir)) {
                File::deleteDirectory($tempDir);
            }
        });

        return response()->download($xlsxPath, $fileName)->deleteFileAfterSend(true);
    }

    public function importRecord(Request $request): JsonResponse
    {
        $selectedOrganizationId = $request->session()->get('admin.organization_id');
        abort_unless($selectedOrganizationId, 422, 'Vui lòng chọn phông trước khi import file.');

        $validated = $request->validate([
            'archive_record_id' => ['required', 'integer', 'exists:archive_records,id'],
            'file' => ['required', 'file', 'mimes:xlsx,xls'],
        ]);

        $record = ArchiveRecord::query()
            ->join('archive_record_items', 'archive_record_items.id', '=', 'archive_records.archive_record_item_id')
            ->where('archive_records.id', (int) $validated['archive_record_id'])
            ->where('archive_record_items.organization_id', (int) $selectedOrganizationId)
            ->select(['archive_records.id'])
            ->first();

        abort_unless($record, 404, 'Không tìm thấy hồ sơ thuộc phông đang chọn.');

        $defaultDocTypeId = DocType::query()->value('id');
        if (! $defaultDocTypeId) {
            throw ValidationException::withMessages([
                'file' => 'Chưa có loại văn bản. Vui lòng tạo ít nhất 1 loại văn bản trước khi import.',
            ]);
        }

        $spreadsheet = IOFactory::load($validated['file']->getRealPath());
        $sheet = $spreadsheet->getSheet(0);

        // Detect header row by looking for STT column
        $headerRow = null;
        $columnMap = [];
        $highestRow = min($sheet->getHighestDataRow(), 50);

        for ($r = 1; $r <= $highestRow; $r++) {
            $rowMap = [];
            $highestCol = Coordinate::columnIndexFromString($sheet->getHighestDataColumn());
            for ($c = 1; $c <= $highestCol; $c++) {
                $raw = (string) $sheet->getCell([$c, $r])->getFormattedValue();
                $norm = $this->normalizeGenericHeader($raw);
                if ($norm === '') continue;
                $field = match (true) {
                    str_contains($norm, 'stt') => 'stt',
                    str_contains($norm, 'sokyhieu') => 'document_code',
                    str_contains($norm, 'ngaythang') => 'document_date',
                    str_contains($norm, 'trichyeu') || str_contains($norm, 'tenloai') => 'description',
                    str_contains($norm, 'tacgia') || str_contains($norm, 'coquanban') => 'author',
                    str_contains($norm, 'nguoiky') => 'signer',
                    str_contains($norm, 'domat') => 'security_level',
                    str_contains($norm, 'loaiban') => 'copy_type',
                    str_contains($norm, 'trangso') => 'page_range',
                    str_contains($norm, 'sotrang') => 'total_pages',
                    str_contains($norm, 'tenkhoaban') || str_contains($norm, 'coquisoan') => 'issuing_agency',
                    str_contains($norm, 'ghichu') => 'note',
                    str_contains($norm, 'tenkhoabanngoai') => 'author_external',
                    default => null,
                };
                if ($field !== null && ! isset($rowMap[$field])) {
                    $rowMap[$field] = $c;
                }
            }
            if (isset($rowMap['stt']) && (isset($rowMap['description']) || isset($rowMap['document_code']))) {
                $headerRow = $r;
                $columnMap = $rowMap;
                break;
            }
        }

        if ($headerRow === null) {
            throw ValidationException::withMessages([
                'file' => 'Không nhận diện được dòng tiêu đề. Vui lòng dùng đúng mẫu export từ hệ thống.',
            ]);
        }

        $highestDataRow = $sheet->getHighestDataRow();
        $createdIds = [];
        $nextStt = $this->getNextDocumentSttForRecord((int) $record->id);
        $emptyCount = 0;

        for ($row = $headerRow + 1; $row <= $highestDataRow; $row++) {
            $get = fn (?int $col) => $col ? trim((string) $sheet->getCell([$col, $row])->getFormattedValue()) : null;

            $description = $get($columnMap['description'] ?? null) ?? '';
            $documentCode = $get($columnMap['document_code'] ?? null);
            $rawDate = $get($columnMap['document_date'] ?? null);

            if ($description === '' && $documentCode === null && $rawDate === null) {
                $emptyCount++;
                if ($emptyCount >= 10) break;
                continue;
            }
            $emptyCount = 0;

            $rawStt = $get($columnMap['stt'] ?? null);
            $stt = is_numeric($rawStt) ? (int) $rawStt : $nextStt;

            // Parse page range like "10-20"
            $rawPageRange = $get($columnMap['page_range'] ?? null);
            [$pageFrom, $pageTo] = $this->extractDangImportPageRange($rawPageRange);

            // Parse total pages
            $rawTotal = $get($columnMap['total_pages'] ?? null);
            $totalPages = is_numeric($rawTotal) ? (int) $rawTotal : null;

            $datePayload = $this->normalizeDocumentDateFields($rawDate ?? '', false);

            $document = Document::create([
                'archive_record_id' => (int) $record->id,
                'created_by' => $request->user()?->id,
                'stt' => $stt,
                'doc_type_id' => $defaultDocTypeId,
                'document_code' => $documentCode,
                'description' => $description ?: '',
                'author' => $get($columnMap['author'] ?? null) ?? $get($columnMap['author_external'] ?? null),
                'issuing_agency' => $get($columnMap['issuing_agency'] ?? null),
                'signer' => $get($columnMap['signer'] ?? null),
                'security_level' => $get($columnMap['security_level'] ?? null),
                'copy_type' => $get($columnMap['copy_type'] ?? null),
                'page_number_from' => $pageFrom,
                'page_number_to' => $pageTo,
                'total_pages' => $this->calculateTotalPages($pageFrom, $pageTo, $totalPages),
                'note' => $get($columnMap['note'] ?? null),
                'document_date' => $datePayload['document_date'],
                'document_date_text' => $datePayload['document_date_text'],
                'document_date_bracketed' => $datePayload['document_date_bracketed'],
            ]);

            $createdIds[] = $document->id;
            $nextStt = max($nextStt, $stt) + 1;
        }

        if (empty($createdIds)) {
            throw ValidationException::withMessages([
                'file' => 'Không tìm thấy dòng dữ liệu hợp lệ để import.',
            ]);
        }

        $createdRows = Document::query()
            ->leftJoin('users', 'users.id', '=', 'documents.created_by')
            ->whereIn('documents.id', $createdIds)
            ->orderByRaw('COALESCE(documents.stt, 999999)')
            ->orderBy('documents.id')
            ->get($this->documentSelectColumns());

        return response()->json([
            'ok' => true,
            'count' => count($createdIds),
            'rows' => $createdRows,
        ]);
    }

    private function normalizeGenericHeader(string $value): string
    {
        return Str::of($value)
            ->ascii()
            ->lower()
            ->replace([' ', "\n", "\r", "\t", ',', '.', ':', ';', '-', '_', '/', '\\', '(', ')'], '')
            ->toString();
    }

    private function buildGenericWorkbook(ArchiveRecord $record, \Illuminate\Database\Eloquent\Collection $documents, string $targetPath): void
    {
        $spreadsheet = new Spreadsheet();
        $spreadsheet->getDefaultStyle()->getFont()->setName('Times New Roman')->setSize(12);
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle($this->makeSheetTitle($record->code ?? $record->reference_code));

        // Title rows
        $sheet->mergeCells('A1:M1');
        $sheet->setCellValue('A1', 'DANH SÁCH TÀI LIỆU');
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14);
        $sheet->getStyle('A1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        $sheet->mergeCells('A2:M2');
        $recordCode = trim((string) ($record->code ?? $record->reference_code ?? ''));
        $sheet->setCellValue('A2', 'Hồ sơ: ' . $recordCode . ' - ' . ($record->title ?? ''));
        $sheet->getStyle('A2')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        // Header row 4
        $headers = [
            'A4' => 'Số TT',
            'B4' => 'Số, ký hiệu',
            'C4' => 'Ngày tháng',
            'D4' => 'Trích yếu nội dung',
            'E4' => 'Tác giả / Cơ quan ban',
            'F4' => 'Người ký',
            'G4' => 'Độ mật',
            'H4' => 'Loại bản',
            'I4' => 'Trang số',
            'J4' => 'Số trang',
            'K4' => 'Tên kho bản ngoài / Cơ quan soạn',
            'L4' => 'Ghi chú',
            'M4' => 'Nhập bởi',
        ];

        foreach ($headers as $cell => $text) {
            $sheet->setCellValue($cell, $text);
        }

        $sheet->getStyle('A4:M4')->getFont()->setBold(true);
        $sheet->getStyle('A4:M4')->getAlignment()
            ->setHorizontal(Alignment::HORIZONTAL_CENTER)
            ->setVertical(Alignment::VERTICAL_CENTER)
            ->setWrapText(true);
        $sheet->getRowDimension(4)->setRowHeight(40);

        $sheet->getColumnDimension('A')->setWidth(8);
        $sheet->getColumnDimension('B')->setWidth(16);
        $sheet->getColumnDimension('C')->setWidth(14);
        $sheet->getColumnDimension('D')->setWidth(36);
        $sheet->getColumnDimension('E')->setWidth(20);
        $sheet->getColumnDimension('F')->setWidth(16);
        $sheet->getColumnDimension('G')->setWidth(12);
        $sheet->getColumnDimension('H')->setWidth(12);
        $sheet->getColumnDimension('I')->setWidth(12);
        $sheet->getColumnDimension('J')->setWidth(10);
        $sheet->getColumnDimension('K')->setWidth(22);
        $sheet->getColumnDimension('L')->setWidth(18);
        $sheet->getColumnDimension('M')->setWidth(16);

        $row = 5;
        $serial = 1;
        foreach ($documents as $doc) {
            $pageFrom = trim((string) ($doc->page_number_from ?? ''));
            $pageTo = trim((string) ($doc->page_number_to ?? ''));
            if ($pageFrom !== '' && $pageTo !== '') {
                $pageRange = "{$pageFrom}-{$pageTo}";
            } elseif ($pageFrom !== '') {
                $pageRange = "{$pageFrom}-{$pageFrom}";
            } else {
                $pageRange = trim((string) ($doc->page_number ?? ''));
            }

            $sheet->setCellValue("A{$row}", $serial);
            $sheet->setCellValue("B{$row}", (string) ($doc->document_code ?? trim(($doc->document_number ?? '') . '/' . ($doc->document_symbol ?? ''), '/')));
            $sheet->setCellValue("C{$row}", $this->formatDocumentDateForExport($doc));
            $sheet->setCellValue("D{$row}", (string) ($doc->description ?? ''));
            $sheet->setCellValue("E{$row}", (string) ($doc->author ?? ''));
            $sheet->setCellValue("F{$row}", (string) ($doc->signer ?? ''));
            $sheet->setCellValue("G{$row}", $this->formatSecurityLevelForExport($doc->security_level));
            $sheet->setCellValue("H{$row}", (string) ($doc->copy_type ?? ''));
            $sheet->setCellValue("I{$row}", $pageRange);
            $sheet->setCellValue("J{$row}", $this->getDisplayPageCountForExport($doc));
            $sheet->setCellValue("K{$row}", (string) ($doc->issuing_agency ?? ''));
            $sheet->setCellValue("L{$row}", (string) ($doc->note ?? ''));
            $sheet->setCellValue("M{$row}", '');
            $row++;
            $serial++;
        }

        $lastRow = max($row - 1, 8);
        $sheet->getStyle("A4:M{$lastRow}")->getBorders()->getAllBorders()->setBorderStyle(Border::BORDER_THIN);
        $sheet->getStyle("D5:D{$lastRow}")->getAlignment()->setWrapText(true);
        for ($r = 5; $r <= $lastRow; $r++) {
            $sheet->getRowDimension($r)->setRowHeight(28);
        }

        (new Xlsx($spreadsheet))->save($targetPath);
        $spreadsheet->disconnectWorksheets();
    }

    private function documentSelectColumns(): array
    {
        return [
            'documents.id',
            'documents.archive_record_id',
            'documents.created_by',
            'documents.stt',
            'documents.doc_type_id',
            'documents.document_number',
            'documents.document_symbol',
            'documents.document_code',
            'documents.description',
            'documents.signer',
            'documents.author',
            'documents.security_level',
            'documents.copy_type',
            'documents.page_number',
            'documents.page_number_from',
            'documents.page_number_to',
            'documents.total_pages',
            'documents.file_count',
            'documents.file_name',
            'documents.document_duration',
            'documents.usage_mode',
            'documents.keywords',
            'documents.language',
            'documents.handwritten',
            'documents.topic',
            'documents.information_code',
            'documents.reliability_level',
            'documents.physical_condition',
            'documents.document_date',
            'documents.document_date_text',
            'documents.document_date_bracketed',
            'documents.issuing_agency',
            'documents.note',
            'documents.created_at',
            'users.name as created_by_name',
        ];
    }
}
