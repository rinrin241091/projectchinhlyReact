<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ArchiveRecord;
use App\Models\ArchiveRecordItem;
use App\Models\Document;
use App\Models\Organization;
use Inertia\Inertia;
use Inertia\Response;

class RecordOverviewController extends Controller
{
    public function index(): Response
    {
        $selectedOrganizationId = request()->session()->get('admin.organization_id');

        $organizations = Organization::query()
            ->when($selectedOrganizationId, fn ($query) => $query->whereKey($selectedOrganizationId))
            ->orderBy('code')
            ->orderBy('name')
            ->get(['id', 'code', 'name']);

        $organizationIds = $organizations->pluck('id')->all();

        $items = ArchiveRecordItem::query()
            ->whereIn('organization_id', $organizationIds)
            ->orderBy('archive_record_item_code')
            ->orderBy('id')
            ->get(['id', 'organization_id', 'archive_record_item_code', 'title']);

        $itemIds = $items->pluck('id')->all();

        $records = ArchiveRecord::query()
            ->where(function ($query) use ($organizationIds, $itemIds) {
                $query->whereIn('organization_id', $organizationIds);
                if (!empty($itemIds)) {
                    $query->orWhereIn('archive_record_item_id', $itemIds);
                }
            })
            ->orderBy('archive_record_item_id')
            ->orderBy('reference_code')
            ->orderBy('id')
            ->get(['id', 'organization_id', 'archive_record_item_id', 'reference_code', 'title', 'page_count']);

        $recordIds = $records->pluck('id')->all();
        $documents = Document::query()
            ->whereIn('archive_record_id', $recordIds)
            ->orderBy('archive_record_id')
            ->orderBy('stt')
            ->orderBy('id')
            ->get([
                'id',
                'archive_record_id',
                'document_code',
                'description',
                'total_pages',
                'page_number',
                'page_number_from',
                'page_number_to',
            ]);

        $documentsByRecordId = [];
        $recordPageTotals = [];
        $recordDocumentTotals = [];

        foreach ($documents as $document) {
            $recordId = (int) $document->archive_record_id;
            $pages = $this->resolveDocumentPages($document);

            $documentsByRecordId[$recordId][] = [
                'id' => 'document-'.$document->id,
                'title' => $this->documentLabel($document->document_code, $document->description, (int) $document->id),
                'total_records' => null,
                'pages' => $pages,
                'document_count' => 1,
                'level' => 'document',
                'children' => [],
            ];

            $recordPageTotals[$recordId] = ($recordPageTotals[$recordId] ?? 0) + $pages;
            $recordDocumentTotals[$recordId] = ($recordDocumentTotals[$recordId] ?? 0) + 1;
        }

        $itemOrganizationById = [];
        foreach ($items as $item) {
            $itemOrganizationById[(int) $item->id] = (int) $item->organization_id;
        }

        $recordsByItemId = [];
        $recordsWithoutItemByOrganizationId = [];
        foreach ($records as $record) {
            $itemId = $record->archive_record_item_id ? (int) $record->archive_record_item_id : null;
            $resolvedOrganizationId = $itemId && isset($itemOrganizationById[$itemId])
                ? $itemOrganizationById[$itemId]
                : (int) $record->organization_id;

            if ($itemId) {
                $recordsByItemId[$itemId][] = $record;
            } elseif ($resolvedOrganizationId > 0) {
                $recordsWithoutItemByOrganizationId[$resolvedOrganizationId][] = $record;
            }
        }

        $itemsByOrganizationId = [];
        foreach ($items as $item) {
            $itemsByOrganizationId[(int) $item->organization_id][] = $item;
        }

        $tree = [];

        foreach ($organizations as $organization) {
            $organizationId = (int) $organization->id;
            $organizationChildren = [];
            $organizationPageTotal = 0;
            $organizationRecordTotal = 0;
            $organizationDocumentTotal = 0;

            $organizationItems = $itemsByOrganizationId[$organizationId] ?? [];
            foreach ($organizationItems as $item) {
                $itemId = (int) $item->id;
                $itemRecords = $recordsByItemId[$itemId] ?? [];

                [$recordChildren, $itemPageTotal, $itemRecordTotal, $itemDocumentTotal] = $this->buildRecordChildren(
                    $itemRecords,
                    $recordPageTotals,
                    $recordDocumentTotals,
                    $documentsByRecordId,
                );

                $organizationChildren[] = [
                    'id' => 'item-'.$itemId,
                    'title' => $this->combineCodeAndName($item->archive_record_item_code, $item->title, 'Muc luc'),
                    'total_records' => $itemRecordTotal,
                    'pages' => $itemPageTotal,
                    'document_count' => $itemDocumentTotal,
                    'level' => 'item',
                    'children' => $recordChildren,
                ];

                $organizationPageTotal += $itemPageTotal;
                $organizationRecordTotal += $itemRecordTotal;
                $organizationDocumentTotal += $itemDocumentTotal;
            }

            $recordsWithoutItem = $recordsWithoutItemByOrganizationId[$organizationId] ?? [];
            if (!empty($recordsWithoutItem)) {
                [$recordChildren, $itemPageTotal, $itemRecordTotal, $itemDocumentTotal] = $this->buildRecordChildren(
                    $recordsWithoutItem,
                    $recordPageTotals,
                    $recordDocumentTotals,
                    $documentsByRecordId,
                );

                $organizationChildren[] = [
                    'id' => 'item-missing-'.$organizationId,
                    'title' => 'Khong co muc luc',
                    'total_records' => $itemRecordTotal,
                    'pages' => $itemPageTotal,
                    'document_count' => $itemDocumentTotal,
                    'level' => 'item',
                    'children' => $recordChildren,
                ];

                $organizationPageTotal += $itemPageTotal;
                $organizationRecordTotal += $itemRecordTotal;
                $organizationDocumentTotal += $itemDocumentTotal;
            }

            $tree[] = [
                'id' => 'organization-'.$organizationId,
                'title' => $this->combineCodeAndName($organization->code, $organization->name, 'Phong'),
                'total_records' => $organizationRecordTotal,
                'pages' => $organizationPageTotal,
                'document_count' => $organizationDocumentTotal,
                'level' => 'organization',
                'children' => $organizationChildren,
            ];
        }

        return Inertia::render('Admin/Records/Index', [
            'items' => $tree,
        ]);
    }

    /**
     * @param array<int, \App\Models\ArchiveRecord> $records
     * @param array<int, int> $recordPageTotals
     * @param array<int, int> $recordDocumentTotals
     * @param array<int, array<int, array<string, mixed>>> $documentsByRecordId
     * @return array{0: array<int, array<string, mixed>>, 1: int, 2: int, 3: int}
     */
    private function buildRecordChildren(
        array $records,
        array $recordPageTotals,
        array $recordDocumentTotals,
        array $documentsByRecordId,
    ): array {
        $children = [];
        $itemPageTotal = 0;
        $itemRecordTotal = 0;
        $itemDocumentTotal = 0;

        foreach ($records as $record) {
            $recordId = (int) $record->id;
            $documents = $documentsByRecordId[$recordId] ?? [];
            $documentCount = (int) ($recordDocumentTotals[$recordId] ?? 0);

            $recordPagesFromDocuments = (int) ($recordPageTotals[$recordId] ?? 0);
            $recordPageTotal = $recordPagesFromDocuments;
            if ($recordPageTotal === 0 && is_numeric($record->page_count)) {
                $recordPageTotal = (int) $record->page_count;
            }

            $children[] = [
                'id' => 'record-'.$recordId,
                'title' => $this->combineCodeAndName($record->reference_code, $record->title, 'Ho so'),
                'total_records' => 1,
                'pages' => $recordPageTotal,
                'document_count' => $documentCount,
                'level' => 'record',
                'children' => $documents,
            ];

            $itemPageTotal += $recordPageTotal;
            $itemRecordTotal++;
            $itemDocumentTotal += $documentCount;
        }

        return [$children, $itemPageTotal, $itemRecordTotal, $itemDocumentTotal];
    }

    private function combineCodeAndName(?string $code, ?string $name, string $fallback): string
    {
        $code = trim((string) ($code ?? ''));
        $name = trim((string) ($name ?? ''));

        if ($code !== '' && $name !== '') {
            return $code.' - '.$name;
        }
        if ($code !== '') {
            return $code;
        }
        if ($name !== '') {
            return $name;
        }

        return $fallback;
    }

    private function documentLabel(?string $code, ?string $description, int $id): string
    {
        $code = trim((string) ($code ?? ''));
        $description = trim((string) ($description ?? ''));

        if ($code !== '' && $description !== '') {
            return $code.' - '.$description;
        }
        if ($code !== '') {
            return $code;
        }
        if ($description !== '') {
            return $description;
        }

        return 'Tai lieu #'.$id;
    }

    private function resolveDocumentPages(Document $document): int
    {
        if (is_numeric($document->total_pages)) {
            return max(0, (int) $document->total_pages);
        }

        $from = $this->parsePositiveInt($document->page_number_from);
        $to = $this->parsePositiveInt($document->page_number_to);
        if ($from !== null && $to !== null && $to >= $from) {
            return $to - $from + 1;
        }

        $pageNumber = trim((string) ($document->page_number ?? ''));
        if (preg_match('/^\s*(\d+)\s*-\s*(\d+)\s*$/', $pageNumber, $matches) === 1) {
            $rangeFrom = (int) $matches[1];
            $rangeTo = (int) $matches[2];
            if ($rangeTo >= $rangeFrom) {
                return $rangeTo - $rangeFrom + 1;
            }
        }

        $single = $this->parsePositiveInt($pageNumber);
        if ($single !== null) {
            return $single;
        }

        return 0;
    }

    private function parsePositiveInt(mixed $value): ?int
    {
        if ($value === null) {
            return null;
        }

        $raw = trim((string) $value);
        if ($raw === '' || preg_match('/^\d+$/', $raw) !== 1) {
            return null;
        }

        return max(0, (int) $raw);
    }
}
