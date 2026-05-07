<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ArchiveRecord;
use App\Models\ArchiveRecordItem;
use App\Models\Box;
use App\Models\Document;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ArchiveRecordController extends Controller
{
    public function index(): Response
    {
        $selectedOrganizationId = request()->session()->get('admin.organization_id');
        $organizationType = null;
        $selectedOrganizationCode = null;
        $archivalId = null;
        if ($selectedOrganizationId) {
            $selectedOrganization = Organization::query()
                ->whereKey($selectedOrganizationId)
                ->first(['id', 'archival_id', 'type', 'code']);

            $archivalId = $selectedOrganization?->archival_id;
            $organizationType = $selectedOrganization?->type;
            $selectedOrganizationCode = $selectedOrganization?->code;
        }

        $boxes = Box::query()
            ->when($archivalId, fn ($query) => $query->whereHas('shelf.storage', fn ($storageQuery) => $storageQuery->where('archival_id', $archivalId)))
            ->orderBy('code')
            ->get(['id', 'code']);

        $items = ArchiveRecordItem::query()
            ->leftJoin('organizations as orgs', 'orgs.id', '=', 'archive_record_items.organization_id')
            ->when($selectedOrganizationId, fn ($query) => $query->where('organization_id', $selectedOrganizationId))
            ->orderBy('archive_record_item_code')
            ->get([
                'archive_record_items.id',
                'archive_record_items.archive_record_item_code',
                'archive_record_items.title',
                'archive_record_items.description',
                'archive_record_items.organization_id',
                DB::raw('orgs.code as organization_code'),
            ]);

        $itemIds = $selectedOrganizationId ? $items->pluck('id')->all() : null;

        $records = ArchiveRecord::query()
            ->when($itemIds !== null, fn ($query) => $query->whereIn('archive_record_item_id', $itemIds))
            ->orderBy('id')
            ->select([
                'id',
                'reference_code',
                'code',
                'title',
                'description',
                'start_date',
                'end_date',
                'preservation_duration',
                'page_count',
                'archive_record_item_id',
                'note',
                'status',
                'box_id',
            ])
            ->selectSub(function ($query) {
                $query->from('documents')
                    ->selectRaw('count(*)')
                    ->whereColumn('documents.archive_record_id', 'archive_records.id');
            }, 'documents_count')
            ->get();

        $computedByRecordId = [];
        if ($organizationType === 'Đảng' && $records->isNotEmpty()) {
            $computedByRecordId = $this->buildDangDocumentSummaryByRecordId($records->pluck('id')->all());
        }

        return Inertia::render('Admin/ArchiveRecords/Index', [
            'rows' => $records
                ->map(function (ArchiveRecord $record) use ($computedByRecordId) {
                    $computed = $computedByRecordId[$record->id] ?? null;
                    $documentsCount = (int) ($computed['documents_count'] ?? $record->documents_count ?? 0);
                    $statusCode = $this->resolveArchiveRecordStatusCode($record->status, $documentsCount);

                    return [
                        'id' => $record->id,
                        'reference_code' => $record->reference_code,
                        'code' => $record->code,
                        'title' => $record->title,
                        'description' => $record->description,
                        'start_date' => $computed['start_date'] ?? $record->start_date,
                        'end_date' => $computed['end_date'] ?? $record->end_date,
                        'preservation_duration' => $record->preservation_duration,
                        'page_count' => $computed['page_count'] ?? $record->page_count,
                        'archive_record_item_id' => $record->archive_record_item_id,
                        'note' => $record->note,
                        'status' => $statusCode,
                        'status_label' => $this->statusLabelFromCode($statusCode),
                        'box_id' => $record->box_id,
                        'documents_count' => $documentsCount,
                        'keywords' => '',
                        'security_level' => $computed['security_level'] ?? '',
                    ];
                }),
            'boxes' => $boxes,
            'items' => $items,
            'organizationType' => $organizationType,
            'selectedOrganizationCode' => $selectedOrganizationCode,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'reference_code' => ['required', 'string', 'max:255'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'preservation_duration' => ['nullable', 'string', 'max:255'],
            'page_count' => ['nullable', 'integer'],
            'archive_record_item_id' => ['nullable', 'integer', 'exists:archive_record_items,id'],
            'note' => ['nullable', 'string'],
            'box_id' => ['nullable', 'integer', 'exists:boxes,id'],
            'status' => ['nullable', 'string', Rule::in(['da_nhap'])],
        ]);
        // Đặt giá trị mặc định cho status nếu không được truyền
        $data['status'] = $data['status'] ?? 'chưa nhập';
        $record = ArchiveRecord::create($data);
        $selectedOrganizationCode = null;
        $selectedOrganizationId = $request->session()->get('admin.organization_id');
        if ($selectedOrganizationId) {
            $selectedOrganizationCode = Organization::query()
                ->whereKey($selectedOrganizationId)
                ->value('code');
        }

        return response()->json([
            'id' => $record->id,
            'reference_code' => $record->reference_code,
            'code' => $record->code,
            'title' => $record->title,
            'description' => $record->description,
            'start_date' => $record->start_date,
            'end_date' => $record->end_date,
            'preservation_duration' => $record->preservation_duration,
            'page_count' => $record->page_count,
            'archive_record_item_id' => $record->archive_record_item_id,
            'note' => $record->note,
            'status' => $record->status,
            'status_label' => $this->statusLabelFromCode(
                $this->resolveArchiveRecordStatusCode($record->status, 0)
            ),
            'box_id' => $record->box_id,
            'documents_count' => 0,
            'keywords' => '',
            'security_level' => '',
            'organization_code_display' => $selectedOrganizationCode,
        ]);
    }

    public function update(Request $request, ArchiveRecord $archiveRecord): JsonResponse
    {
        $data = $request->validate([
            'field' => ['required', Rule::in(['reference_code', 'title', 'description', 'start_date', 'end_date', 'preservation_duration', 'page_count', 'archive_record_item_id', 'note', 'box_id', 'status'])],
            'value' => ['nullable'],
        ]);

        $field = $data['field'];
        $value = $data['value'];

        $rules = match ($field) {
            'reference_code' => ['required', 'string', 'max:255'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'preservation_duration' => ['nullable', 'string', 'max:255'],
            'page_count' => ['nullable', 'integer'],
            'archive_record_item_id' => ['nullable', 'integer', 'exists:archive_record_items,id'],
            'note' => ['nullable', 'string'],
            'box_id' => ['nullable', 'integer', 'exists:boxes,id'],
            'status' => ['nullable', 'string', Rule::in(['da_nhap'])],
        };

        $request->validate(['value' => $rules]);

        $archiveRecord->{$field} = $value;
        $archiveRecord->save();

        $documentsCount = Document::query()
            ->where('archive_record_id', $archiveRecord->id)
            ->count();
        $statusCode = $this->resolveArchiveRecordStatusCode($archiveRecord->status, (int) $documentsCount);

        return response()->json([
            'ok' => true,
            'status' => $statusCode,
            'status_label' => $this->statusLabelFromCode($statusCode),
            'documents_count' => (int) $documentsCount,
        ]);
    }

    public function destroy(ArchiveRecord $archiveRecord): JsonResponse
    {
        $archiveRecord->delete();

        return response()->json(['ok' => true]);
    }

    public function export(Request $request): BinaryFileResponse
    {
        $selectedOrganizationId = $request->session()->get('admin.organization_id');
        $selectedItemId = $request->query('archive_record_item_id');

        $organization = null;
        $organizationType = null;
        if ($selectedOrganizationId) {
            $organization = Organization::query()
                ->whereKey((int) $selectedOrganizationId)
                ->first(['id', 'code', 'name', 'type', 'archivals_time']);
            abort_unless($organization, 404, 'Không tìm thấy phông đang chọn.');
            $organizationType = $organization->type;
        }

        $itemQuery = ArchiveRecordItem::query()
            ->when($selectedOrganizationId, fn ($query) => $query->where('organization_id', (int) $selectedOrganizationId))
            ->orderBy('archive_record_item_code');

        if (!blank($selectedItemId)) {
            $itemQuery->where('id', (int) $selectedItemId);
        }

        $items = $itemQuery->get(['id', 'archive_record_item_code', 'title', 'description', 'organization_id']);
        abort_if($items->isEmpty(), 422, 'Không có mục lục hồ sơ để xuất.');

        $itemIds = $items->pluck('id')->all();
        $records = ArchiveRecord::query()
            ->whereIn('archive_record_item_id', $itemIds)
            ->orderBy('id')
            ->get([
                'id',
                'reference_code',
                'code',
                'title',
                'description',
                'start_date',
                'end_date',
                'preservation_duration',
                'page_count',
                'archive_record_item_id',
                'note',
                'box_id',
            ]);

        abort_if($records->isEmpty(), 422, 'Không có hồ sơ lưu trữ để xuất.');

        $itemCodeById = $items->pluck('archive_record_item_code', 'id');
        $itemDescriptionById = $items->pluck('description', 'id');

        $organizationCodeById = Organization::query()
            ->whereIn('id', $items->pluck('organization_id')->filter()->unique()->all())
            ->pluck('code', 'id');

        $itemOrgCodeById = $items->mapWithKeys(function ($item) use ($organizationCodeById) {
            return [(int) $item->id => (string) ($organizationCodeById[(int) $item->organization_id] ?? '')];
        });

        $boxCodeById = Box::query()
            ->whereIn('id', $records->pluck('box_id')->filter()->unique()->all())
            ->pluck('code', 'id');

        $documentsCountByRecordId = Document::query()
            ->whereIn('archive_record_id', $records->pluck('id')->all())
            ->selectRaw('archive_record_id, count(*) as total')
            ->groupBy('archive_record_id')
            ->pluck('total', 'archive_record_id');

        $computedByRecordId = [];
        if ($organizationType === 'Đảng' && $records->isNotEmpty()) {
            $computedByRecordId = $this->buildDangDocumentSummaryByRecordId($records->pluck('id')->all());
        }

        $tempDir = storage_path('app/tmp/archive-record-exports/' . Str::uuid());
        File::ensureDirectoryExists($tempDir);

        $fileName = 'Muc-luc-ho-so-' . now()->format('Ymd_His') . '.xlsx';
        $targetPath = $tempDir . DIRECTORY_SEPARATOR . $fileName;

        $this->buildArchiveRecordWorkbook(
            $records,
            $targetPath,
            $organization,
            $itemCodeById,
            $itemDescriptionById,
            $itemOrgCodeById,
            $boxCodeById,
            $documentsCountByRecordId,
            $computedByRecordId
        );

        app()->terminating(function () use ($tempDir): void {
            if (is_dir($tempDir)) {
                File::deleteDirectory($tempDir);
            }
        });

        return response()->download($targetPath, $fileName)->deleteFileAfterSend(true);
    }

    private function buildDangDocumentSummaryByRecordId(array $recordIds): array
    {
        if (empty($recordIds)) {
            return [];
        }

        $documents = DB::table('documents')
            ->whereIn('archive_record_id', $recordIds)
            ->get([
                'archive_record_id',
                'document_date',
                'page_number',
                'total_pages',
                'page_number_from',
                'page_number_to',
                'security_level',
            ]);

        $summary = [];

        foreach ($documents as $document) {
            $recordId = (int) $document->archive_record_id;
            if (!isset($summary[$recordId])) {
                $summary[$recordId] = [
                    'start_date' => null,
                    'end_date' => null,
                    'page_count' => 0,
                    'documents_count' => 0,
                    'security_rank' => 0,
                ];
            }

            $date = $document->document_date ? (string) $document->document_date : null;
            if ($date !== null) {
                if ($summary[$recordId]['start_date'] === null || $date < $summary[$recordId]['start_date']) {
                    $summary[$recordId]['start_date'] = $date;
                }
                if ($summary[$recordId]['end_date'] === null || $date > $summary[$recordId]['end_date']) {
                    $summary[$recordId]['end_date'] = $date;
                }
            }

            $pages = $this->resolveDocumentPagesForSummary($document);
            $summary[$recordId]['page_count'] += max(0, (int) ($pages ?? 0));
            $summary[$recordId]['documents_count']++;

            $summary[$recordId]['security_rank'] = max(
                $summary[$recordId]['security_rank'],
                $this->securityRank($document->security_level),
            );
        }

        foreach ($summary as $recordId => $data) {
            $summary[$recordId]['security_level'] = $this->securityLabelFromRank($data['security_rank']);
            unset($summary[$recordId]['security_rank']);
        }

        return $summary;
    }

    private function calculateTotalPagesFromRange(mixed $fromValue, mixed $toValue): int
    {
        $from = $this->parseSheetNumber($fromValue);
        $to = $this->parseSheetNumber($toValue);

        if ($from === null || $to === null || $to < $from) {
            return 0;
        }

        return $to - $from + 1;
    }

    private function resolveDocumentPagesForSummary(object $document): int
    {
        $manualPageCount = trim((string) ($document->page_number ?? ''));
        $manualNumeric = $this->parseSheetNumber($manualPageCount);
        if ($manualNumeric !== null) {
            return $manualNumeric;
        }

        if (is_numeric($document->total_pages)) {
            return max(0, (int) $document->total_pages);
        }

        return $this->calculateTotalPagesFromRange(
            $document->page_number_from ?? null,
            $document->page_number_to ?? null,
        );
    }

    private function parseSheetNumber(mixed $value): ?int
    {
        if ($value === null) {
            return null;
        }

        $raw = trim((string) $value);
        if ($raw === '' || !preg_match('/^\d+$/', $raw)) {
            return null;
        }

        return (int) $raw;
    }

    private function resolveArchiveRecordStatusCode(mixed $storedStatus, int $documentsCount): string
    {
        $normalized = Str::of((string) ($storedStatus ?? ''))
            ->lower()
            ->ascii()
            ->replaceMatches('/[^a-z0-9]+/', '_')
            ->trim('_')
            ->value();

        if ($normalized === 'da_nhap') {
            return 'da_nhap';
        }

        return $documentsCount > 0 ? 'dang_nhap' : 'chua_nhap';
    }

    private function statusLabelFromCode(string $statusCode): string
    {
        return match ($statusCode) {
            'da_nhap' => 'Đã nhập',
            'dang_nhap' => 'Đang nhập',
            default => 'Chưa nhập',
        };
    }

    private function securityRank(mixed $value): int
    {
        $normalized = Str::of((string) ($value ?? ''))
            ->lower()
            ->ascii()
            ->replaceMatches('/\s+/', ' ')
            ->trim()
            ->value();

        if ($normalized === '') {
            return 0;
        }

        if (str_contains($normalized, 'tuyet mat')) {
            return 4;
        }
        if (str_contains($normalized, 'toi mat')) {
            return 3;
        }
        if (str_contains($normalized, 'mat')) {
            return 2;
        }
        if (str_contains($normalized, 'thuong')) {
            return 1;
        }

        return 0;
    }

    private function securityLabelFromRank(int $rank): string
    {
        return match (true) {
            $rank >= 4 => 'Tuyệt mật',
            $rank === 3 => 'Tối mật',
            $rank === 2 => 'Mật',
            $rank === 1 => 'Thường',
            default => '',
        };
    }

    private function buildArchiveRecordWorkbook(
        Collection $records,
        string $targetPath,
        ?Organization $organization,
        Collection $itemCodeById,
        Collection $itemDescriptionById,
        Collection $itemOrgCodeById,
        Collection $boxCodeById,
        Collection $documentsCountByRecordId,
        array $computedByRecordId
    ): void {
        $spreadsheet = new Spreadsheet();
        $spreadsheet->getDefaultStyle()->getFont()->setName('Times New Roman')->setSize(12);
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Mục lục hồ sơ');

        $sheet->mergeCells('N1:O1');
        $sheet->setCellValue('N1', 'Phụ lục số 02');
        $sheet->getStyle('N1')->getFont()->setItalic(true);
        $sheet->getStyle('N1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);

        $sheet->mergeCells('A2:N2');
        $sheet->setCellValue('A2', 'MỤC LỤC HỒ SƠ');
        $sheet->getStyle('A2')->getFont()->setBold(true)->setSize(16);
        $sheet->getStyle('A2')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        $sheet->mergeCells('A3:N3');
        $phongText = $organization
            ? sprintf('Phông lưu trữ: %s - %s, khóa(nhiệm kỳ): %s', (string) $organization->code, (string) $organization->name, (string) ($organization->archivals_time ?? ''))
            : 'Phông lưu trữ: Tất cả';
        $sheet->setCellValue('A3', $phongText);
        $sheet->getStyle('A3')->getFont()->setBold(true);
        $sheet->getStyle('A3')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        $sheet->mergeCells('A4:N4');
        $sheet->setCellValue('A4', '-----------------------------');
        $sheet->getStyle('A4')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        $headers = [
            'A6' => 'Số cặp (hộp)',
            'B6' => 'Phông số',
            'C6' => 'Mục lục số',
            'D6' => 'Hồ sơ số (đơn vị bảo quản số)',
            'E6' => 'Tên nhóm và tên hồ sơ (đơn vị bảo quản)',
            'F6' => 'Thời gian bắt đầu và kết thúc',
            'G6' => 'Số trang',
            'H6' => 'Số tài liệu',
            'I6' => 'Thời hạn bảo quản',
            'J6' => 'Độ mật',
            'K6' => 'Chú giải',
            'L6' => 'Từ khóa',
            'M6' => 'Ghi chú',
            'N6' => 'Tên thư mục hồ sơ',
        ];

        foreach ($headers as $cell => $text) {
            $sheet->setCellValue($cell, $text);
        }

        $sheet->getStyle('A6:N6')->getFont()->setBold(true);
        $sheet->getStyle('A6:N6')->getAlignment()
            ->setHorizontal(Alignment::HORIZONTAL_CENTER)
            ->setVertical(Alignment::VERTICAL_CENTER)
            ->setWrapText(true);
        $sheet->getRowDimension(6)->setRowHeight(48);

        $sheet->getColumnDimension('A')->setWidth(12);
        $sheet->getColumnDimension('B')->setWidth(11);
        $sheet->getColumnDimension('C')->setWidth(11);
        $sheet->getColumnDimension('D')->setWidth(16);
        $sheet->getColumnDimension('E')->setWidth(30);
        $sheet->getColumnDimension('F')->setWidth(18);
        $sheet->getColumnDimension('G')->setWidth(8);
        $sheet->getColumnDimension('H')->setWidth(9);
        $sheet->getColumnDimension('I')->setWidth(12);
        $sheet->getColumnDimension('J')->setWidth(8);
        $sheet->getColumnDimension('K')->setWidth(9);
        $sheet->getColumnDimension('L')->setWidth(9);
        $sheet->getColumnDimension('M')->setWidth(10);
        $sheet->getColumnDimension('N')->setWidth(24);

        $row = 7;
        foreach ($records as $record) {
            $recordId = (int) $record->id;
            $itemId = (int) $record->archive_record_item_id;
            $computed = $computedByRecordId[$recordId] ?? null;

            $startDate = $computed['start_date'] ?? $record->start_date;
            $endDate = $computed['end_date'] ?? $record->end_date;
            $dateRange = trim($this->formatDateForExport($startDate) . "\n" . $this->formatDateForExport($endDate));

            $pageCount = $computed['page_count'] ?? $record->page_count ?? 0;
            $documentsCount = (int) ($computed['documents_count'] ?? ($documentsCountByRecordId[$recordId] ?? 0));
            $security = (string) ($computed['security_level'] ?? '');

            $recordNumber = $this->extractArchiveRecordNumber($record->code, $record->reference_code);
            $sheet->setCellValue("A{$row}", (string) ($boxCodeById[$record->box_id] ?? ''));
            $sheet->setCellValue("B{$row}", (string) ($itemOrgCodeById[$itemId] ?? ($organization?->code ?? '')));
            $sheet->setCellValue("C{$row}", (string) ($itemCodeById[$itemId] ?? ''));
            $sheet->setCellValue("D{$row}", $recordNumber);
            $sheet->setCellValue("E{$row}", (string) ($record->title ?? ''));
            $sheet->setCellValue("F{$row}", $dateRange);
            $sheet->setCellValue("G{$row}", (int) $pageCount);
            $sheet->setCellValue("H{$row}", $documentsCount);
            $sheet->setCellValue("I{$row}", (string) ($record->preservation_duration ?? ''));
            $sheet->setCellValue("J{$row}", $security);
            $sheet->setCellValue("K{$row}", (string) ($record->description ?? ''));
            $sheet->setCellValue("L{$row}", (string) ($itemDescriptionById[$itemId] ?? ''));
            $sheet->setCellValue("M{$row}", (string) ($record->note ?? ''));
            $sheet->setCellValue("N{$row}", '');
            $row++;
        }

        $lastDataRow = max($row - 1, 7);
        $sheet->getStyle("A6:N{$lastDataRow}")
            ->getBorders()
            ->getAllBorders()
            ->setBorderStyle(Border::BORDER_THIN);

        $sheet->getStyle("A7:N{$lastDataRow}")
            ->getAlignment()
            ->setVertical(Alignment::VERTICAL_TOP);
        $sheet->getStyle("E7:F{$lastDataRow}")
            ->getAlignment()
            ->setWrapText(true);

        for ($r = 7; $r <= $lastDataRow; $r++) {
            $sheet->getRowDimension($r)->setRowHeight(28);
        }

        $writer = new Xlsx($spreadsheet);
        $writer->save($targetPath);
        $spreadsheet->disconnectWorksheets();
    }

    private function extractArchiveRecordNumber(mixed $code, mixed $referenceCode): string
    {
        $directCode = trim((string) ($code ?? ''));
        if ($directCode !== '') {
            return $directCode;
        }

        $ref = trim((string) ($referenceCode ?? ''));
        if ($ref === '') {
            return '';
        }

        $parts = array_values(array_filter(array_map('trim', explode('-', $ref))));
        if (empty($parts)) {
            return $ref;
        }

        return (string) end($parts);
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
}
