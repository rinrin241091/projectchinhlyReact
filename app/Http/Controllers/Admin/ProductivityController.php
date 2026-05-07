<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ProductivityController extends Controller
{
    public function index(Request $request): Response
    {
        $selectedOrganizationId = $this->resolveSelectedOrganizationId($request);
        $organizationLabel = $this->resolveOrganizationLabel($selectedOrganizationId);

        [$rows, $totalDocuments] = $this->buildProductivityRows($selectedOrganizationId);

        return Inertia::render('Admin/Productivity/Index', [
            'rows' => $rows,
            'summary' => [
                'totalEmployees' => count($rows),
                'totalDocuments' => $totalDocuments,
                'organizationLabel' => $organizationLabel,
            ],
        ]);
    }

    public function export(Request $request): BinaryFileResponse
    {
        $selectedOrganizationId = $this->resolveSelectedOrganizationId($request);
        $organizationLabel = $this->resolveOrganizationLabel($selectedOrganizationId);
        [$rows, $totalDocuments] = $this->buildProductivityRows($selectedOrganizationId);

        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('San luong');

        $sheet->mergeCells('A1:F1');
        $sheet->setCellValue('A1', 'THỐNG KÊ SẢN LƯỢNG NHÂN VIÊN NHẬP LIỆU');
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(14);
        $sheet->getStyle('A1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

        $sheet->mergeCells('A2:F2');
        $sheet->setCellValue('A2', 'Phông: ' . $organizationLabel);
        $sheet->getStyle('A2')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);

        $sheet->mergeCells('A3:F3');
        $sheet->setCellValue('A3', 'Thời gian xuất: ' . now()->format('d/m/Y H:i'));
        $sheet->getStyle('A3')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);

        $headers = [
            'A5' => 'STT',
            'B5' => 'Nhân viên',
            'C5' => 'Email',
            'D5' => 'Vai trò',
            'E5' => 'Tổng số tài liệu nhập',
            'F5' => 'Tỷ lệ (%)',
        ];

        foreach ($headers as $cell => $text) {
            $sheet->setCellValue($cell, $text);
        }

        $sheet->getStyle('A5:F5')->getFont()->setBold(true);
        $sheet->getStyle('A5:F5')->getAlignment()
            ->setHorizontal(Alignment::HORIZONTAL_CENTER)
            ->setVertical(Alignment::VERTICAL_CENTER);

        $sheet->getColumnDimension('A')->setWidth(8);
        $sheet->getColumnDimension('B')->setWidth(28);
        $sheet->getColumnDimension('C')->setWidth(34);
        $sheet->getColumnDimension('D')->setWidth(16);
        $sheet->getColumnDimension('E')->setWidth(24);
        $sheet->getColumnDimension('F')->setWidth(12);

        $rowNumber = 6;
        foreach ($rows as $row) {
            $percent = $totalDocuments > 0
                ? round(($row['totalDocuments'] / $totalDocuments) * 100, 2)
                : 0;

            $sheet->setCellValue("A{$rowNumber}", $row['stt']);
            $sheet->setCellValue("B{$rowNumber}", $row['name']);
            $sheet->setCellValue("C{$rowNumber}", $row['email']);
            $sheet->setCellValue("D{$rowNumber}", $row['roleLabel']);
            $sheet->setCellValue("E{$rowNumber}", $row['totalDocuments']);
            $sheet->setCellValue("F{$rowNumber}", $percent);
            $rowNumber++;
        }

        $summaryRow = $rowNumber;
        $sheet->mergeCells("A{$summaryRow}:D{$summaryRow}");
        $sheet->setCellValue("A{$summaryRow}", 'Tổng cộng');
        $sheet->setCellValue("E{$summaryRow}", $totalDocuments);
        $sheet->setCellValue("F{$summaryRow}", 100);

        $sheet->getStyle("A{$summaryRow}:F{$summaryRow}")->getFont()->setBold(true);
        $sheet->getStyle("A{$summaryRow}:F{$summaryRow}")
            ->getAlignment()
            ->setHorizontal(Alignment::HORIZONTAL_CENTER)
            ->setVertical(Alignment::VERTICAL_CENTER);

        $endRow = max($summaryRow, 6);
        $sheet->getStyle("A5:F{$endRow}")
            ->getBorders()
            ->getAllBorders()
            ->setBorderStyle(Border::BORDER_THIN);

        $sheet->getStyle("E6:F{$endRow}")->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);

        $safeLabel = Str::slug($organizationLabel ?: 'tat-ca');
        $fileName = 'san-luong-nhan-vien-nhap-lieu-' . $safeLabel . '-' . now()->format('Ymd_His') . '.xlsx';
        $directory = storage_path('app/tmp/productivity-exports');
        File::ensureDirectoryExists($directory);
        $filePath = $directory . DIRECTORY_SEPARATOR . Str::uuid() . '.xlsx';

        $writer = new Xlsx($spreadsheet);
        $writer->save($filePath);
        $spreadsheet->disconnectWorksheets();

        return response()->download($filePath, $fileName)->deleteFileAfterSend(true);
    }

    private function buildProductivityRows(?int $selectedOrganizationId): array
    {
        $documentCountByUserId = Document::query()
            ->selectRaw('documents.created_by as created_by, COUNT(documents.id) as total_documents')
            ->join('archive_records', 'archive_records.id', '=', 'documents.archive_record_id')
            ->join('archive_record_items', 'archive_record_items.id', '=', 'archive_records.archive_record_item_id')
            ->when(
                $selectedOrganizationId,
                fn ($query) => $query->where('archive_record_items.organization_id', $selectedOrganizationId)
            )
            ->whereNotNull('documents.created_by')
            ->groupBy('documents.created_by')
            ->pluck('total_documents', 'created_by');

        $employees = User::query()
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'role'])
            ->filter(fn (User $user) => $this->normalizeRole($user->role) === 'nhap_lieu')
            ->values();

        $rows = $employees
            ->map(function (User $user) use ($documentCountByUserId) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'roleLabel' => 'Nhập liệu',
                    'totalDocuments' => (int) ($documentCountByUserId[$user->id] ?? 0),
                ];
            })
            ->sortByDesc('totalDocuments')
            ->values()
            ->map(function (array $row, int $index) {
                $row['stt'] = $index + 1;
                return $row;
            })
            ->all();

        $totalDocuments = array_sum(array_column($rows, 'totalDocuments'));

        return [$rows, $totalDocuments];
    }

    private function resolveSelectedOrganizationId(Request $request): ?int
    {
        $value = $request->session()->get('admin.organization_id');
        if (! $value) {
            return null;
        }

        return (int) $value;
    }

    private function resolveOrganizationLabel(?int $organizationId): string
    {
        if (! $organizationId) {
            return 'Tất cả';
        }

        return (string) (
            Organization::query()
                ->whereKey($organizationId)
                ->value('name')
        ?: 'Không xác định');
    }

    private function normalizeRole(?string $role): string
    {
        return (string) Str::of((string) $role)
            ->trim()
            ->lower()
            ->ascii()
            ->replaceMatches('/[^a-z0-9]+/', '_')
            ->trim('_');
    }
}

