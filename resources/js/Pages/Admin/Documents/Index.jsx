import AdminLayout from '../../../Layouts/AdminLayout';
import { Head, usePage } from '@inertiajs/react';
import { AgGridReact } from 'ag-grid-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import 'ag-grid-community/styles/ag-theme-quartz.css';

const RECORD_SELECTION_STORAGE_KEY = 'admin.documents.record-selection.v1';

export default function Index({ rows, docTypes, archiveRecords, items, organizationType }) {
    const page = usePage();
    const currentUser = page.props?.auth?.user;
    const userAgent = typeof window !== 'undefined' ? window.navigator?.userAgent ?? '' : '';
    const isWindows7 =
        typeof window !== 'undefined' && /Windows NT 6\.1/i.test(userAgent);
    const chromeMajorVersion = (() => {
        const match = userAgent.match(/Chrome\/(\d+)/i);
        return match ? Number(match[1]) : null;
    })();
    const isLegacyChrome =
        typeof chromeMajorVersion === 'number' &&
        Number.isFinite(chromeMajorVersion) &&
        chromeMajorVersion > 0 &&
        chromeMajorVersion < 112;
    const useLegacyGridScrollbarFallback = isWindows7 || isLegacyChrome;
    const [allRows, setAllRows] = useState(() => rows);
    const [selectedItemId, setSelectedItemId] = useState(items?.[0]?.id ?? '');
    const [selectedRecordId, setSelectedRecordId] = useState(null);
    const [activeRowId, setActiveRowId] = useState(null);
    const [recordSearchInput, setRecordSearchInput] = useState('');
    const [recordSearchKeyword, setRecordSearchKeyword] = useState('');
    const [qrPreviewRow, setQrPreviewRow] = useState(null);
    const [rowContextMenu, setRowContextMenu] = useState({
        visible: false,
        x: 0,
        y: 0,
        rowId: null,
        selectedIds: [],
    });
    const [selectedRowIds, setSelectedRowIds] = useState([]);
    const gridApiRef = useRef(null);
    const importInputRef = useRef(null);
    const importRecordInputRef = useRef(null);
    const contextMenuRef = useRef(null);
    const recordListRef = useRef(null);
    const win7ScrollbarObserverRef = useRef(null);

    const readSavedSelection = () => {
        if (typeof window === 'undefined') {
            return { selectedItemId: '', recordByItem: {} };
        }
        try {
            const raw = window.localStorage.getItem(RECORD_SELECTION_STORAGE_KEY);
            if (!raw) {
                return { selectedItemId: '', recordByItem: {} };
            }
            const parsed = JSON.parse(raw);
            return {
                selectedItemId: String(parsed?.selectedItemId ?? ''),
                recordByItem:
                    typeof parsed?.recordByItem === 'object' && parsed?.recordByItem !== null
                        ? parsed.recordByItem
                        : {},
            };
        } catch {
            return { selectedItemId: '', recordByItem: {} };
        }
    };

    const writeSavedSelection = (selection) => {
        if (typeof window === 'undefined') {
            return;
        }
        window.localStorage.setItem(RECORD_SELECTION_STORAGE_KEY, JSON.stringify(selection));
    };

    const isDang = organizationType === 'Đảng';
    const isChinhQuyen = organizationType === 'Chính quyền';

    const formatDate = (value) => {
        if (!value) {
            return '';
        }
        if (value instanceof Date) {
            const year = value.getFullYear();
            const month = `${value.getMonth() + 1}`.padStart(2, '0');
            const day = `${value.getDate()}`.padStart(2, '0');
            return `${day}/${month}/${year}`;
        }
        if (typeof value !== 'string') {
            return '';
        }
        const normalized = value.includes('/') ? value : value.replace(/-/g, '/');
        const parts = normalized.split('/');
        if (parts.length !== 3) {
            return value;
        }
        const [year, month, day] = value.includes('-') ? value.split('-') : [parts[2], parts[1], parts[0]];
        if (!year || !month || !day) {
            return value;
        }
        return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
    };

    const formatDateTime = (value) => {
        if (!value) {
            return '';
        }
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) {
            return '';
        }
        const day = `${date.getDate()}`.padStart(2, '0');
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        const year = date.getFullYear();
        const hour = `${date.getHours()}`.padStart(2, '0');
        const minute = `${date.getMinutes()}`.padStart(2, '0');
        return `${day}/${month}/${year} ${hour}:${minute}`;
    };

    const parseDateInput = (value) => {
        if (!value) {
            return null;
        }
        if (value instanceof Date) {
            const year = value.getFullYear();
            const month = `${value.getMonth() + 1}`.padStart(2, '0');
            const day = `${value.getDate()}`.padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        if (typeof value !== 'string') {
            return value;
        }
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        if (trimmed.includes('/')) {
            const [day, month, year] = trimmed.split('/');
            if (day && month && year) {
                return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
        }
        return trimmed;
    };

    const formatDocumentDateDisplay = (row) => {
        const textValue = String(row?.document_date_text ?? '').trim();
        if (textValue) {
            return textValue;
        }
        return formatDate(row?.document_date);
    };

    const normalizeDocumentDateState = (rawValue, bracketed) => {
        const raw =
            rawValue === null || rawValue === undefined
                ? ''
                : rawValue instanceof Date
                    ? rawValue
                    : String(rawValue).trim();

        if (raw === '' || (typeof raw === 'string' && !raw.trim())) {
            return {
                valueForRequest: null,
                document_date: null,
                document_date_text: null,
            };
        }

        if (bracketed && typeof raw === 'string' && /^\d{4}$/.test(raw.trim())) {
            return {
                valueForRequest: raw.trim(),
                document_date: null,
                document_date_text: raw.trim(),
            };
        }

        const parsed = parseDateInput(raw);

        if (typeof parsed === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed)) {
            return {
                valueForRequest: parsed,
                document_date: parsed,
                document_date_text: bracketed ? formatDate(parsed) : null,
            };
        }

        if (typeof parsed === 'string') {
            const parsedDate = new Date(parsed);
            if (!Number.isNaN(parsedDate.getTime())) {
                const isoDate = parseDateInput(parsedDate);
                return {
                    valueForRequest: isoDate,
                    document_date: isoDate,
                    document_date_text: bracketed ? formatDate(isoDate) : null,
                };
            }
        }

        return {
            valueForRequest: parsed,
            document_date: typeof parsed === 'string' ? parsed : null,
            document_date_text: bracketed ? String(rawValue ?? '').trim() : null,
        };
    };

    const parseSheetNumber = (value) => {
        if (value === null || value === undefined) {
            return null;
        }
        const raw = String(value).trim();
        if (!raw) {
            return null;
        }
        if (!/^\d+$/.test(raw)) {
            return null;
        }
        return Number(raw);
    };

    const calculateTotalPages = (fromValue, toValue) => {
        const from = parseSheetNumber(fromValue);
        const to = parseSheetNumber(toValue);

        if (from === null || to === null || to < from) {
            return null;
        }

        return to - from + 1;
    };

    const getComputedTotalPages = (row) => {
        const calculated = calculateTotalPages(row?.page_number_from, row?.page_number_to);
        if (calculated !== null) {
            return calculated;
        }

        const stored = Number(row?.total_pages);
        return Number.isFinite(stored) && stored > 0 ? stored : null;
    };

    const getDisplayPageCount = (row) => {
        const manualValue = String(row?.page_number ?? '').trim();
        if (manualValue !== '') {
            return manualValue;
        }

        const computed = getComputedTotalPages(row);
        return computed ?? '';
    };

    const canWriteDocument = (row) => {
        if (!row) {
            return false;
        }
        const normalizedRole = String(currentUser?.role ?? '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[\s-]+/g, '_');

        if (normalizedRole === 'admin') {
            return true;
        }
        if (normalizedRole === 'nhap_lieu') {
            return Number(row.created_by) === Number(currentUser?.id);
        }
        return false;
    };

    const formatSummaryText = (value) => {
        const text = String(value ?? '').trim();
        if (!text) {
            return '';
        }

        const limited = text.length > 200 ? `${text.slice(0, 200)}...` : text;
        const words = limited.split(/\s+/).filter(Boolean);
        const lines = [];

        for (let index = 0; index < words.length; index += 7) {
            lines.push(words.slice(index, index + 7).join(' '));
        }

        return lines.join('\n');
    };

    const itemOptions = useMemo(
        () =>
            (items ?? []).map((item) => ({
                value: item.id,
                label: `${item.archive_record_item_code} - ${item.title}`,
            })),
        [items],
    );

    const itemNameById = useMemo(() => {
        const map = new Map();
        (items ?? []).forEach((item) => {
            map.set(item.id, item.title ?? '');
        });
        return map;
    }, [items]);

    const recordsByItem = useMemo(() => {
        const map = new Map();
        (archiveRecords ?? []).forEach((record) => {
            const list = map.get(record.archive_record_item_id) ?? [];
            list.push(record);
            map.set(record.archive_record_item_id, list);
        });
        return map;
    }, [archiveRecords]);

    const recordMetaById = useMemo(() => {
        const map = new Map();
        (archiveRecords ?? []).forEach((record) => {
            map.set(record.id, {
                referenceCode: record.code ?? record.reference_code ?? '',
                title: record.title ?? '',
                archiveRecordItemId: record.archive_record_item_id ?? null,
                boxCode: record.box_code ?? '',
                shelfCode: record.shelf_code ?? '',
            });
        });
        return map;
    }, [archiveRecords]);

    const getRecordCode = (record) => String(record?.code ?? record?.reference_code ?? '').trim();
    const recordCodeCollator = useMemo(
        () => new Intl.Collator('vi', { numeric: true, sensitivity: 'base' }),
        [],
    );

    const recordsForSelectedItem = useMemo(() => {
        if (!selectedItemId) {
            return [];
        }
        const list = recordsByItem.get(Number(selectedItemId)) ?? [];
        return [...list].sort((a, b) => {
            const codeA = getRecordCode(a);
            const codeB = getRecordCode(b);
            const compare = recordCodeCollator.compare(codeA, codeB);
            if (compare !== 0) {
                return compare;
            }
            return Number(a?.id ?? 0) - Number(b?.id ?? 0);
        });
    }, [recordsByItem, selectedItemId, recordCodeCollator]);

    const filteredRecordsForSelectedItem = useMemo(() => {
        const keyword = recordSearchKeyword.trim().toLowerCase();
        if (!keyword) {
            return recordsForSelectedItem;
        }

        return recordsForSelectedItem.filter((record) => {
            const recordCode = getRecordCode(record).toLowerCase();
            return recordCode.includes(keyword);
        });
    }, [recordSearchKeyword, recordsForSelectedItem]);

    useEffect(() => {
        if (!items?.length) {
            return;
        }

        const savedSelection = readSavedSelection();
        const savedItemId = String(savedSelection.selectedItemId ?? '');
        if (!savedItemId) {
            return;
        }

        const itemExists = items.some((item) => String(item.id) === savedItemId);
        if (itemExists && String(selectedItemId) !== savedItemId) {
            setSelectedItemId(savedItemId);
        }
    }, [items]);

    useEffect(() => {
        if (!selectedItemId) {
            setSelectedRecordId(null);
            return;
        }
        if (filteredRecordsForSelectedItem.length === 0) {
            setSelectedRecordId(null);
            return;
        }

        const hasSelected = filteredRecordsForSelectedItem.some(
            (record) => Number(record.id) === Number(selectedRecordId),
        );

        if (!hasSelected) {
            const savedSelection = readSavedSelection();
            const savedRecordId = savedSelection.recordByItem?.[String(selectedItemId)];
            const preferred = filteredRecordsForSelectedItem.find(
                (record) => Number(record.id) === Number(savedRecordId),
            );
            setSelectedRecordId(preferred ? preferred.id : filteredRecordsForSelectedItem[0]?.id ?? null);
        }
    }, [filteredRecordsForSelectedItem, selectedItemId, selectedRecordId]);

    useEffect(() => {
        const current = readSavedSelection();
        const next = {
            selectedItemId: String(selectedItemId ?? ''),
            recordByItem: { ...(current.recordByItem ?? {}) },
        };

        if (selectedItemId && selectedRecordId) {
            next.recordByItem[String(selectedItemId)] = Number(selectedRecordId);
        }

        writeSavedSelection(next);
    }, [selectedItemId, selectedRecordId]);

    useEffect(() => {
        setRecordSearchInput('');
        setRecordSearchKeyword('');
    }, [selectedItemId]);

    useEffect(() => {
        setActiveRowId(null);
        setSelectedRowIds([]);
        closeRowContextMenu();
    }, [selectedRecordId]);

    useEffect(() => {
        if (!selectedRecordId) {
            setAllRows([]);
            return undefined;
        }

        let isCancelled = false;
        setAllRows([]);

        const fetchRows = async () => {
            try {
                const response = await window.axios.get('/admin/documents/rows', {
                    params: { record_id: selectedRecordId },
                });

                if (isCancelled) {
                    return;
                }

                setAllRows(sortDocumentRows(response?.data?.rows ?? []));
            } catch (error) {
                if (isCancelled) {
                    return;
                }

                setAllRows([]);
                const message =
                    error?.response?.data?.message ||
                    Object.values(error?.response?.data?.errors ?? {})
                        .flat()
                        .join('\n') ||
                    'Không tải được danh sách tài liệu.';
                alert(message);
            }
        };

        fetchRows();

        return () => {
            isCancelled = true;
        };
    }, [selectedRecordId]);

    useEffect(() => {
        if (!isWindows7 || useLegacyGridScrollbarFallback) {
            return;
        }

        const timer = setTimeout(() => {
            forceWin7GridScrollbars(gridApiRef.current);
        }, 0);

        return () => clearTimeout(timer);
    }, [isWindows7, useLegacyGridScrollbarFallback, selectedRecordId, allRows.length]);

    useEffect(() => {
        return () => {
            if (win7ScrollbarObserverRef.current) {
                win7ScrollbarObserverRef.current.disconnect();
                win7ScrollbarObserverRef.current = null;
            }
        };
    }, []);

    const scrollSelectedRecordIntoView = (recordId = selectedRecordId) => {
        if (!recordId) {
            return;
        }

        const container = recordListRef.current;
        if (!container) {
            return;
        }

        requestAnimationFrame(() => {
            const selectedButton = container.querySelector(
                `button[data-record-id="${String(recordId)}"]`,
            );
            if (!selectedButton) {
                return;
            }

            const containerTop = container.scrollTop;
            const containerBottom = containerTop + container.clientHeight;
            const buttonTop = selectedButton.offsetTop;
            const buttonBottom = buttonTop + selectedButton.offsetHeight;

            if (buttonTop < containerTop || buttonBottom > containerBottom) {
                selectedButton.scrollIntoView({ block: 'center', behavior: 'auto' });
            }
        });
    };

    useEffect(() => {
        if (!defaultDocTypeId) {
            alert('Chưa có loại văn bản. Vui lòng tạo Loại văn bản trước.');
            return;
        }

        scrollSelectedRecordIntoView(selectedRecordId);
    }, [selectedItemId, selectedRecordId, filteredRecordsForSelectedItem]);

    useEffect(() => {
        if (!rowContextMenu.visible) {
            return undefined;
        }

        const onWindowKeyDown = (event) => {
            if (event.key === 'Escape') {
                closeRowContextMenu();
            }
        };

        const onWindowScroll = () => {
            closeRowContextMenu();
        };

        const onWindowMouseDown = (event) => {
            const menuEl = contextMenuRef.current;
            if (!menuEl) {
                closeRowContextMenu();
                return;
            }
            if (!menuEl.contains(event.target)) {
                closeRowContextMenu();
            }
        };

        window.addEventListener('keydown', onWindowKeyDown);
        window.addEventListener('scroll', onWindowScroll, true);
        window.addEventListener('resize', onWindowScroll);
        window.addEventListener('mousedown', onWindowMouseDown);

        return () => {
            window.removeEventListener('keydown', onWindowKeyDown);
            window.removeEventListener('scroll', onWindowScroll, true);
            window.removeEventListener('resize', onWindowScroll);
            window.removeEventListener('mousedown', onWindowMouseDown);
        };
    }, [rowContextMenu.visible]);

    const filteredRows = useMemo(() => {
        if (!selectedRecordId) {
            return [];
        }
        return allRows.filter((row) => Number(row.archive_record_id) === Number(selectedRecordId));
    }, [allRows, selectedRecordId]);

    const getNextSttForRecord = () =>
        allRows
            .filter((row) => Number(row.archive_record_id) === Number(selectedRecordId))
            .reduce((max, row) => {
                const stt = Number(row.stt);
                return Number.isFinite(stt) ? Math.max(max, stt) : max;
            }, 0) + 1;

    const getNextDraftId = () => {
        const minId = allRows.reduce((min, row) => Math.min(min, row.id ?? 0), 0);
        return minId <= 0 ? minId - 1 : -1;
    };

    const sortDocumentRows = (list) =>
        [...list].sort((left, right) => {
            const archiveRecordCompare =
                Number(left?.archive_record_id ?? 0) - Number(right?.archive_record_id ?? 0);
            if (archiveRecordCompare !== 0) {
                return archiveRecordCompare;
            }

            const leftStt = Number.isFinite(Number(left?.stt)) ? Number(left.stt) : Number.MAX_SAFE_INTEGER;
            const rightStt = Number.isFinite(Number(right?.stt)) ? Number(right.stt) : Number.MAX_SAFE_INTEGER;
            if (leftStt !== rightStt) {
                return leftStt - rightStt;
            }

            return Number(left?.id ?? 0) - Number(right?.id ?? 0);
        });

    const focusDocumentRow = (rowId, preferredColKey) => {
        setTimeout(() => {
            const api = gridApiRef.current;
            if (!api) {
                return;
            }

            const displayedCount = api.getDisplayedRowCount();
            let rowIndex = -1;
            for (let index = 0; index < displayedCount; index += 1) {
                const rowNode = api.getDisplayedRowAtIndex(index);
                if (Number(rowNode?.data?.id) === Number(rowId)) {
                    rowIndex = index;
                    break;
                }
            }

            if (rowIndex < 0) {
                return;
            }

            const focusColKey = preferredColKey ?? (isDang || isChinhQuyen ? 'document_code' : 'document_number');
            const pageSize = api.paginationGetPageSize?.() ?? 10;
            const targetPage = Math.floor(rowIndex / pageSize);

            if (api.paginationGoToPage) {
                api.paginationGoToPage(targetPage);
            }

            api.ensureIndexVisible(rowIndex, 'bottom');
            api.setFocusedCell(rowIndex, focusColKey);
            api.startEditingCell({ rowIndex, colKey: focusColKey });

            const rowNode = api.getDisplayedRowAtIndex(rowIndex);
            if (rowNode) {
                api.flashCells({ rowNodes: [rowNode] });
            }
        }, 0);
    };

    const resolveActiveRow = () => {
        if (!selectedRecordId) {
            return null;
        }

        if (activeRowId !== null && activeRowId !== undefined) {
            const rowByActiveId = allRows.find(
                (row) =>
                    Number(row.id) === Number(activeRowId) &&
                    Number(row.archive_record_id) === Number(selectedRecordId),
            );
            if (rowByActiveId) {
                return rowByActiveId;
            }
        }

        const api = gridApiRef.current;
        const focusedCell = api?.getFocusedCell?.();
        if (focusedCell && focusedCell.rowIndex >= 0) {
            const rowNode = api.getDisplayedRowAtIndex(focusedCell.rowIndex);
            if (
                rowNode?.data &&
                Number(rowNode.data.archive_record_id) === Number(selectedRecordId)
            ) {
                return rowNode.data;
            }
        }

        return null;
    };

    const closeRowContextMenu = () => {
        setRowContextMenu((current) =>
            current.visible ? { visible: false, x: 0, y: 0, rowId: null, selectedIds: [] } : current,
        );
    };

    const getSelectedRowIdsFromApi = (api) =>
        (api?.getSelectedRows?.() ?? [])
            .map((row) => row?.id)
            .filter((id) => id !== null && id !== undefined)
            .map((id) => String(id));

    const forceWin7GridScrollbars = (api) => {
        if (!isWindows7 || useLegacyGridScrollbarFallback || !api?.getGui) {
            return;
        }

        const root = api.getGui();
        if (!root) {
            return;
        }

        root.querySelectorAll('.ag-body-horizontal-scroll, .ag-body-vertical-scroll').forEach((el) => {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.style.opacity = '0';
        });

        root.querySelectorAll('.ag-body-viewport, .ag-center-cols-viewport').forEach((el) => {
            el.style.overflowY = 'auto';
            el.style.overflowX = 'auto';
            el.style.msOverflowStyle = 'scrollbar';
        });
    };

    const attachWin7ScrollbarObserver = (api) => {
        if (
            !isWindows7 ||
            useLegacyGridScrollbarFallback ||
            !api?.getGui ||
            typeof MutationObserver === 'undefined'
        ) {
            return;
        }

        if (win7ScrollbarObserverRef.current) {
            win7ScrollbarObserverRef.current.disconnect();
            win7ScrollbarObserverRef.current = null;
        }

        const root = api.getGui();
        if (!root) {
            return;
        }

        const observer = new MutationObserver(() => {
            forceWin7GridScrollbars(api);
        });

        observer.observe(root, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['class', 'style'],
        });

        win7ScrollbarObserverRef.current = observer;
    };

    const scheduleForceWin7Scrollbars = (api) => {
        if (!isWindows7 || useLegacyGridScrollbarFallback) {
            return;
        }

        forceWin7GridScrollbars(api);
        setTimeout(() => forceWin7GridScrollbars(api), 0);
        setTimeout(() => forceWin7GridScrollbars(api), 60);
        setTimeout(() => forceWin7GridScrollbars(api), 180);
    };

    const applySelection = (api, ids) => {
        if (!api) {
            return;
        }
        const normalizedIds = Array.from(
            new Set(
                (ids ?? [])
                    .filter((id) => id !== null && id !== undefined)
                    .map((id) => String(id)),
            ),
        );
        const selectedIdSet = new Set(normalizedIds);
        api.forEachNode((node) => {
            const rowId = node?.data?.id;
            if (rowId === null || rowId === undefined) {
                return;
            }
            node.setSelected(selectedIdSet.has(String(rowId)));
        });
        setSelectedRowIds(normalizedIds);
    };

    const openRowContextMenu = (event, rowId, api) => {
        const nativeEvent = event?.event ?? event;
        if (!nativeEvent) {
            return;
        }
        if (nativeEvent.preventDefault) {
            nativeEvent.preventDefault();
        }
        if (nativeEvent.stopPropagation) {
            nativeEvent.stopPropagation();
        }
        if (nativeEvent.stopImmediatePropagation) {
            nativeEvent.stopImmediatePropagation();
        }
        if ('returnValue' in nativeEvent) {
            nativeEvent.returnValue = false;
        }

        const viewportWidth = window.innerWidth || 1280;
        const viewportHeight = window.innerHeight || 720;
        const menuWidth = 170;
        const menuHeight = 96;
        const padding = 8;

        const clampedX = Math.max(
            padding,
            Math.min(nativeEvent.clientX ?? 0, viewportWidth - menuWidth - padding),
        );
        const clampedY = Math.max(
            padding,
            Math.min(nativeEvent.clientY ?? 0, viewportHeight - menuHeight - padding),
        );

        const rowIdKey = rowId !== null && rowId !== undefined ? String(rowId) : null;
        const selectedFromApi = getSelectedRowIdsFromApi(api);
        const selectedSet = new Set(
            selectedFromApi.length > 0 ? selectedFromApi : selectedRowIds,
        );
        if (rowIdKey && !selectedSet.has(rowIdKey)) {
            selectedSet.clear();
            selectedSet.add(rowIdKey);
        }
        const selectedIds = Array.from(selectedSet);
        setSelectedRowIds(selectedIds);

        setRowContextMenu({
            visible: true,
            x: clampedX,
            y: clampedY,
            rowId: rowId ?? null,
            selectedIds,
        });
    };

    const docTypeOptions = useMemo(
        () =>
            docTypes.map((docType) => ({
                value: docType.id,
                label: docType.name,
            })),
        [docTypes],
    );
    const defaultDocTypeId = docTypeOptions[0]?.value ?? null;

    const docTypeNameById = useMemo(() => {
        const map = new Map();
        docTypes.forEach((docType) => {
            map.set(docType.id, docType.name);
        });
        return map;
    }, [docTypes]);

    const securityLevelOptions = useMemo(
        () => ['Thường', 'Mật', 'Tuyệt mật', 'Tối mật'],
        [],
    );

    const formatSecurityLevelLabel = (value) => {
        const raw = String(value ?? '').trim();
        if (!raw) {
            return '';
        }

        const normalized = raw
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (normalized === 'thuong') {
            return 'Thường';
        }
        if (normalized === 'mat') {
            return 'Mật';
        }
        if (normalized === 'tuyet mat') {
            return 'Tuyệt mật';
        }
        if (normalized === 'toi mat') {
            return 'Tối mật';
        }

        return raw;
    };

    const copyTypeOptions = useMemo(
        () => ['Bản chính', 'Bản sao'],
        [],
    );

    const buildQrData = (row) => {
        const meta = recordMetaById.get(row?.archive_record_id) ?? {};
        const lines = [
            `Tên tài liệu - Trích yếu nội dung: ${row?.description || ''}`,
            `Số ký hiệu VB: ${row?.document_code || ''}`,
            `Tên hồ sơ: ${meta.title || ''}`,
            `Tên hộp: ${meta.boxCode ? `Hộp ${meta.boxCode}` : ''}`,
            `Tên kệ: ${meta.shelfCode ? `Kệ ${meta.shelfCode}` : ''}`,
        ];
        const payload = lines.join('\n');
        const imageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=340x340&data=${encodeURIComponent(payload)}`;
        return { lines, imageUrl };
    };

    const columnDefs = useMemo(() => {
        const actionColumn = {
            headerName: '',
            field: 'actions',
            maxWidth: 120,
            sortable: false,
            filter: false,
            cellRenderer: ({ data }) => (
                <button
                    type="button"
                    onClick={() => onDelete(data.id)}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-rose-600"
                >
                    Xóa
                </button>
            ),
        };

        const createdByColumn = {
            field: 'created_by_name',
            headerName: 'Người nhập',
            width: 170,
            minWidth: 150,
            maxWidth: 260,
            editable: false,
            valueGetter: ({ data }) => data?.created_by_name ?? '',
        };

        const qrColumn = {
            field: 'qr',
            headerName: 'QR',
            maxWidth: 90,
            editable: false,
            sortable: false,
            filter: false,
            cellRenderer: ({ data }) => (
                <button
                    type="button"
                    onClick={() => setQrPreviewRow(data)}
                    className="rounded-lg border border-stone-300 px-3 py-1 text-xs font-semibold text-[var(--text-main)] hover:bg-stone-50"
                >
                    Xem
                </button>
            ),
        };

        const dangColumns = [
            {
                field: 'stt',
                headerName: 'STT',
                maxWidth: 110,
                editable: false,
                valueGetter: (params) => {
                    const rowIndex = params?.node?.rowIndex;
                    return rowIndex !== null && rowIndex !== undefined && rowIndex >= 0 ? rowIndex + 1 : '';
                },
            },
            {
                field: 'document_code',
                headerName: 'Số/Ký hiệu',
                width: 220,
                minWidth: 200,
                maxWidth: 340,
                editable: true,
            },
            {
                field: 'document_date_bracketed',
                headerName: '[]',
                width: 70,
                minWidth: 70,
                maxWidth: 70,
                editable: true,
                cellRenderer: 'agCheckboxCellRenderer',
                cellEditor: 'agCheckboxCellEditor',
                valueGetter: ({ data }) => Boolean(data?.document_date_bracketed),
                valueSetter: ({ data, newValue }) => {
                    data.document_date_bracketed = Boolean(newValue);
                    return true;
                },
            },
            {
                field: 'document_date',
                headerName: 'Ngày tháng',
                maxWidth: 160,
                editable: true,
                cellEditor: 'agDateCellEditor',
                cellEditorParams: { useBrowserDatePicker: true },
                valueFormatter: ({ data }) => formatDocumentDateDisplay(data),
                valueParser: ({ newValue }) => parseDateInput(newValue),
            },
            {
                field: 'description',
                headerName: 'Trích yếu',
                width: 250,
                minWidth: 250,
                maxWidth: 560,
                editable: true,
                valueFormatter: ({ value }) => formatSummaryText(value),
                tooltipValueGetter: ({ value }) => String(value ?? ''),
                wrapText: true,
                autoHeight: true,
                cellStyle: {
                    lineHeight: '1.35',
                    paddingTop: '6px',
                    paddingBottom: '6px',
                    whiteSpace: 'pre-line',
                },
            },
            {
                field: 'issuing_agency',
                headerName: 'Tác giả',
                width: 240,
                minWidth: 220,
                maxWidth: 380,
                editable: true,
                sortable: true,
                filter: true,
                suppressHeaderMenuButton: false,
                valueFormatter: ({ value, data }) => value ?? data?.author ?? '',
            },
            { field: 'signer', headerName: 'Người ký', maxWidth: 160, editable: true },
            {
                field: 'security_level',
                headerName: 'Độ mật',
                maxWidth: 140,
                editable: true,
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: { values: securityLevelOptions },
                valueFormatter: ({ value }) => formatSecurityLevelLabel(value),
            },
            {
                field: 'copy_type',
                headerName: 'Loại bản',
                maxWidth: 140,
                editable: true,
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: { values: copyTypeOptions },
            },
            { field: 'page_number_from', headerName: 'Từ trang số', maxWidth: 120, editable: true },
            { field: 'page_number_to', headerName: 'Đến trang số', maxWidth: 120, editable: true },
            {
                field: 'page_number',
                headerName: 'Số trang',
                maxWidth: 120,
                editable: true,
                valueGetter: ({ data }) => getDisplayPageCount(data),
                valueSetter: ({ data, newValue }) => {
                    data.page_number = newValue ?? '';
                    return true;
                },
            },
            { field: 'keywords', headerName: 'Từ khóa', maxWidth: 160, editable: true },
            { field: 'note', headerName: 'Ghi chú', maxWidth: 160, editable: true },
            { field: 'file_count', headerName: 'Số lượng tệp', maxWidth: 140, editable: true },
            { field: 'file_name', headerName: 'Tên tệp tài liệu', maxWidth: 180, editable: true },
        ];

        const chinhQuyenColumns = [
            {
                field: 'stt',
                headerName: 'STT',
                maxWidth: 90,
                editable: false,
                valueGetter: (params) => {
                    const rowIndex = params?.node?.rowIndex;
                    return rowIndex !== null && rowIndex !== undefined && rowIndex >= 0 ? rowIndex + 1 : '';
                },
            },
            {
                field: 'document_code',
                headerName: 'Số ký hiệu',
                width: 220,
                minWidth: 200,
                maxWidth: 340,
                editable: true,
            },
            {
                field: 'document_date_bracketed',
                headerName: '[]',
                width: 70,
                minWidth: 70,
                maxWidth: 70,
                editable: true,
                cellRenderer: 'agCheckboxCellRenderer',
                cellEditor: 'agCheckboxCellEditor',
                valueGetter: ({ data }) => Boolean(data?.document_date_bracketed),
                valueSetter: ({ data, newValue }) => {
                    data.document_date_bracketed = Boolean(newValue);
                    return true;
                },
            },
            {
                field: 'document_date',
                headerName: 'Ngày tháng',
                maxWidth: 160,
                editable: true,
                cellEditor: 'agDateCellEditor',
                cellEditorParams: { useBrowserDatePicker: true },
                valueFormatter: ({ data }) => formatDocumentDateDisplay(data),
                valueParser: ({ newValue }) => parseDateInput(newValue),
            },
            {
                field: 'description',
                headerName: 'Trích yếu',
                width: 250,
                minWidth: 250,
                maxWidth: 560,
                editable: true,
                valueFormatter: ({ value }) => formatSummaryText(value),
                tooltipValueGetter: ({ value }) => String(value ?? ''),
                wrapText: true,
                autoHeight: true,
                cellStyle: {
                    lineHeight: '1.35',
                    paddingTop: '6px',
                    paddingBottom: '6px',
                    whiteSpace: 'pre-line',
                },
            },
            {
                field: 'record_code_display',
                headerName: 'Mã hồ sơ',
                maxWidth: 130,
                editable: false,
                valueGetter: ({ data }) => recordMetaById.get(data?.archive_record_id)?.referenceCode ?? '',
            },
            {
                field: 'record_type_display',
                headerName: 'Loại hồ sơ',
                maxWidth: 170,
                editable: false,
                valueGetter: ({ data }) => {
                    const recordMeta = recordMetaById.get(data?.archive_record_id);
                    return itemNameById.get(recordMeta?.archiveRecordItemId) ?? '';
                },
            },
            {
                field: 'issuing_agency',
                headerName: 'Tác giả',
                width: 240,
                minWidth: 220,
                maxWidth: 380,
                editable: true,
                valueFormatter: ({ value, data }) => value ?? data?.author ?? '',
            },
            { field: 'page_number_from', headerName: 'Từ tờ', maxWidth: 130, editable: true },
            { field: 'page_number_to', headerName: 'Đến tờ', maxWidth: 130, editable: true },
            {
                field: 'page_number',
                headerName: 'Số trang',
                maxWidth: 120,
                editable: true,
                valueGetter: ({ data }) => getDisplayPageCount(data),
                valueSetter: ({ data, newValue }) => {
                    data.page_number = newValue ?? '';
                    return true;
                },
            },
            { field: 'note', headerName: 'Ghi chú', flex: 1, editable: true },
            qrColumn,
            {
                field: 'created_at',
                headerName: 'Ngày tạo',
                maxWidth: 160,
                editable: false,
                valueFormatter: ({ value }) => formatDateTime(value),
            },
        ];

        const fullColumns = [
            {
                field: 'stt',
                headerName: 'STT',
                maxWidth: 90,
                editable: false,
                valueGetter: (params) => {
                    const rowIndex = params?.node?.rowIndex;
                    return rowIndex !== null && rowIndex !== undefined && rowIndex >= 0 ? rowIndex + 1 : '';
                },
            },
            {
                field: 'doc_type_id',
                headerName: 'Loại văn bản',
                maxWidth: 160,
                editable: true,
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: { values: docTypeOptions.map((option) => option.value) },
                valueFormatter: ({ value }) => docTypeNameById.get(value) ?? '',
            },
            { field: 'document_number', headerName: 'Số văn bản', maxWidth: 160, editable: true },
            { field: 'document_symbol', headerName: 'Ký hiệu', maxWidth: 160, editable: true },
            { field: 'document_code', headerName: 'Mã văn bản', maxWidth: 160, editable: true },
            { field: 'description', headerName: 'Mô tả', width: 320, minWidth: 280, maxWidth: 440, editable: true },
            { field: 'signer', headerName: 'Người ký', maxWidth: 160, editable: true },
            {
                field: 'issuing_agency',
                headerName: 'Tác giả',
                maxWidth: 160,
                editable: true,
                sortable: true,
                filter: true,
                suppressHeaderMenuButton: false,
                valueFormatter: ({ value, data }) => value ?? data?.author ?? '',
            },
            {
                field: 'security_level',
                headerName: 'Mức độ mật',
                maxWidth: 160,
                editable: true,
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: { values: securityLevelOptions },
                valueFormatter: ({ value }) => formatSecurityLevelLabel(value),
            },
            {
                field: 'copy_type',
                headerName: 'Loại bản',
                maxWidth: 140,
                editable: true,
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: { values: copyTypeOptions },
            },
            { field: 'page_number_from', headerName: 'Từ trang số', maxWidth: 120, editable: true },
            { field: 'page_number_to', headerName: 'Đến trang số', maxWidth: 120, editable: true },
            {
                field: 'page_number',
                headerName: 'Tổng trang',
                maxWidth: 120,
                editable: true,
                valueGetter: ({ data }) => getDisplayPageCount(data),
                valueSetter: ({ data, newValue }) => {
                    data.page_number = newValue ?? '';
                    return true;
                },
            },
            { field: 'file_count', headerName: 'Số tệp', maxWidth: 120, editable: true },
            { field: 'file_name', headerName: 'Tên tệp', maxWidth: 180, editable: true },
            { field: 'document_duration', headerName: 'Thời hạn lưu', maxWidth: 160, editable: true },
            { field: 'usage_mode', headerName: 'Hình thức sử dụng', maxWidth: 180, editable: true },
            { field: 'keywords', headerName: 'Từ khóa', maxWidth: 180, editable: true },
            { field: 'language', headerName: 'Ngôn ngữ', maxWidth: 140, editable: true },
            { field: 'handwritten', headerName: 'Chữ viết tay', maxWidth: 140, editable: true },
            { field: 'topic', headerName: 'Chủ đề', maxWidth: 160, editable: true },
            { field: 'information_code', headerName: 'Mã thông tin', maxWidth: 160, editable: true },
            { field: 'reliability_level', headerName: 'Độ tin cậy', maxWidth: 140, editable: true },
            { field: 'physical_condition', headerName: 'Tình trạng', maxWidth: 140, editable: true },
            {
                field: 'document_date_bracketed',
                headerName: '[]',
                width: 70,
                minWidth: 70,
                maxWidth: 70,
                editable: true,
                cellRenderer: 'agCheckboxCellRenderer',
                cellEditor: 'agCheckboxCellEditor',
                valueGetter: ({ data }) => Boolean(data?.document_date_bracketed),
                valueSetter: ({ data, newValue }) => {
                    data.document_date_bracketed = Boolean(newValue);
                    return true;
                },
            },
            {
                field: 'document_date',
                headerName: 'Ngày văn bản',
                maxWidth: 160,
                editable: true,
                cellEditor: 'agDateCellEditor',
                cellEditorParams: { useBrowserDatePicker: true },
                valueFormatter: ({ data }) => formatDocumentDateDisplay(data),
                valueParser: ({ newValue }) => parseDateInput(newValue),
            },
            { field: 'issuing_agency', headerName: 'Cơ quan ban hành', maxWidth: 180, editable: true },
            { field: 'note', headerName: 'Ghi chú', maxWidth: 180, editable: true },
        ];

        if (isDang) {
            return [...dangColumns, createdByColumn, actionColumn];
        }
        if (isChinhQuyen) {
            return [...chinhQuyenColumns, createdByColumn, actionColumn];
        }
        return [...fullColumns, createdByColumn, actionColumn];
    }, [
        copyTypeOptions,
        docTypeNameById,
        docTypeOptions,
        isChinhQuyen,
        isDang,
        itemNameById,
        recordMetaById,
        securityLevelOptions,
    ]);

    const normalizeValue = (field, value, rowData = null) => {
        if (field === 'doc_type_id') {
            if (value === null || value === undefined || value === '') {
                return null;
            }
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
        }
        if (field === 'document_date_bracketed') {
            return Boolean(value);
        }
        if (field === 'security_level') {
            return formatSecurityLevelLabel(value);
        }
        if (field === 'stt' || field === 'total_pages' || field === 'file_count') {
            if (value === null || value === undefined || value === '') {
                return null;
            }
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
        }
        if (field === 'document_date') {
            const normalized = normalizeDocumentDateState(
                value,
                Boolean(rowData?.document_date_bracketed),
            );
            return normalized.valueForRequest;
        }
        return value;
    };

    const isDraftReady = (row) => Boolean(row.document_number) || Boolean(row.document_code) || Boolean(row.description);

    const onCellValueChanged = async (params) => {
        const { data, colDef, newValue, oldValue } = params;
        const field = colDef.field;
        const editableFields = new Set([
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
            'document_date_bracketed',
            'document_date',
            'issuing_agency',
            'note',
        ]);

        if (!editableFields.has(field)) {
            return;
        }

        if (!data.isDraft && !canWriteDocument(data)) {
            params.node.setDataValue(field, oldValue);
            alert('Bạn chỉ được sửa tài liệu do chính bạn tạo.');
            return;
        }

        const isRangeField = field === 'page_number_from' || field === 'page_number_to';
        const oldTotalPages = data.total_pages;
        const oldDocumentDateText = data.document_date_text ?? null;

        if (newValue === oldValue) {
            return;
        }

        const normalizedValue = normalizeValue(field, newValue, data);
        const documentDateState =
            field === 'document_date'
                ? normalizeDocumentDateState(newValue, Boolean(data.document_date_bracketed))
                : null;

        if (data.isDraft) {
            const updatedDraft = { ...data, [field]: normalizedValue };
            if (field === 'document_date' && documentDateState) {
                updatedDraft.document_date = documentDateState.document_date;
                updatedDraft.document_date_text = documentDateState.document_date_text;
            }
            if (field === 'document_date_bracketed') {
                updatedDraft.document_date_bracketed = Boolean(normalizedValue);
                if (!updatedDraft.document_date_bracketed) {
                    updatedDraft.document_date_text = null;
                } else if (updatedDraft.document_date && !updatedDraft.document_date_text) {
                    updatedDraft.document_date_text = formatDate(updatedDraft.document_date);
                }
            }
            if (isRangeField) {
                updatedDraft.total_pages = calculateTotalPages(
                    updatedDraft.page_number_from,
                    updatedDraft.page_number_to,
                );
            }

            setAllRows((current) =>
                current.map((row) => (row.id === data.id ? updatedDraft : row)),
            );

            if (!isDraftReady(updatedDraft)) {
                return;
            }

            try {
                const response = await window.axios.post('/admin/documents', {
                    archive_record_id: updatedDraft.archive_record_id ?? null,
                    stt: updatedDraft.stt ?? null,
                    doc_type_id: updatedDraft.doc_type_id ?? defaultDocTypeId ?? null,
                    document_number: updatedDraft.document_number ?? '',
                    document_symbol: updatedDraft.document_symbol ?? '',
                    document_code: updatedDraft.document_code ?? '',
                    description: updatedDraft.description ?? '',
                    signer: updatedDraft.signer ?? '',
                    author: updatedDraft.author ?? '',
                    security_level: updatedDraft.security_level ?? '',
                    copy_type: updatedDraft.copy_type ?? '',
                    page_number: updatedDraft.page_number ?? '',
                    page_number_from: updatedDraft.page_number_from ?? '',
                    page_number_to: updatedDraft.page_number_to ?? '',
                    total_pages: updatedDraft.total_pages ?? null,
                    file_count: updatedDraft.file_count ?? null,
                    file_name: updatedDraft.file_name ?? '',
                    document_duration: updatedDraft.document_duration ?? '',
                    usage_mode: updatedDraft.usage_mode ?? '',
                    keywords: updatedDraft.keywords ?? '',
                    language: updatedDraft.language ?? '',
                    handwritten: updatedDraft.handwritten ?? '',
                    topic: updatedDraft.topic ?? '',
                    information_code: updatedDraft.information_code ?? '',
                    reliability_level: updatedDraft.reliability_level ?? '',
                    physical_condition: updatedDraft.physical_condition ?? '',
                    document_date: updatedDraft.document_date ?? null,
                    document_date_text: updatedDraft.document_date_text ?? null,
                    document_date_bracketed: Boolean(updatedDraft.document_date_bracketed),
                    issuing_agency: updatedDraft.issuing_agency ?? '',
                    note: updatedDraft.note ?? '',
                });
                setAllRows((current) =>
                    current.map((row) => (row.id === data.id ? response.data : row)),
                );
            } catch (error) {
                const message =
                    error?.response?.data?.message ||
                    Object.values(error?.response?.data?.errors ?? {})
                        .flat()
                        .join('\n') ||
                    'Create failed. Please try again.';
                alert(message);
            }
            return;
        }

        const optimisticTotalPages = isRangeField
            ? calculateTotalPages(
                  field === 'page_number_from' ? normalizedValue : data.page_number_from,
                  field === 'page_number_to' ? normalizedValue : data.page_number_to,
              )
            : data.total_pages;

        const optimisticDocumentDateText =
            field === 'document_date'
                ? documentDateState?.document_date_text ?? null
                : field === 'document_date_bracketed'
                    ? normalizedValue
                        ? data.document_date_text ?? formatDate(data.document_date)
                        : null
                    : data.document_date_text ?? null;

        setAllRows((current) =>
            current.map((row) =>
                row.id === data.id
                    ? {
                          ...row,
                          [field]: normalizedValue,
                          total_pages: optimisticTotalPages,
                          document_date:
                              field === 'document_date'
                                  ? documentDateState?.document_date ?? null
                                  : row.document_date,
                          document_date_text: optimisticDocumentDateText,
                          document_date_bracketed:
                              field === 'document_date_bracketed'
                                  ? Boolean(normalizedValue)
                                  : row.document_date_bracketed,
                      }
                    : row,
            ),
        );
        if (isRangeField) {
            params.node.setDataValue('total_pages', optimisticTotalPages);
        }

        try {
            const payload = {
                field,
                value: normalizedValue ?? null,
            };

            if (field === 'document_date') {
                payload.document_date_text = documentDateState?.document_date_text ?? null;
                payload.document_date_bracketed = Boolean(data.document_date_bracketed);
            }

            await window.axios.patch(`/admin/documents/${data.id}`, payload);
        } catch (error) {
            setAllRows((current) =>
                current.map((row) =>
                    row.id === data.id
                        ? {
                              ...row,
                              [field]: oldValue,
                              total_pages: oldTotalPages,
                              document_date: field === 'document_date' ? oldValue : row.document_date,
                              document_date_text: oldDocumentDateText,
                              document_date_bracketed:
                                  field === 'document_date_bracketed'
                                      ? Boolean(oldValue)
                                      : row.document_date_bracketed,
                          }
                        : row,
                ),
            );
            params.node.setDataValue(field, oldValue);
            if (isRangeField) {
                params.node.setDataValue('total_pages', oldTotalPages);
            }
            const message =
                error?.response?.data?.message ||
                Object.values(error?.response?.data?.errors ?? {})
                    .flat()
                    .join('\n') ||
                'Update failed. Please check the value and try again.';
            alert(message);
        }
    };

    const onAddRow = async () => {
        if (!selectedRecordId) {
            alert('Vui lòng chọn hồ sơ trước.');
            return;
        }
        if (!defaultDocTypeId) {
            alert('Chua co loai van ban. Vui long tao Loai van ban truoc.');
            return;
        }

        scrollSelectedRecordIntoView(selectedRecordId);
        try {
            const draftId = getNextDraftId();
            const nextStt = getNextSttForRecord();

            const draftRow = {
                id: draftId,
                archive_record_id: selectedRecordId,
                stt: nextStt,
                doc_type_id: defaultDocTypeId,
                document_number: '',
                document_symbol: '',
                document_code: '',
                description: '',
                signer: '',
                author: '',
                security_level: 'Thường',
                copy_type: 'Bản chính',
                page_number: '',
                page_number_from: '',
                page_number_to: '',
                total_pages: null,
                file_count: isDang ? 1 : null,
                file_name: '',
                document_duration: '',
                usage_mode: '',
                keywords: '',
                language: '',
                handwritten: '',
                topic: '',
                information_code: '',
                reliability_level: '',
                physical_condition: '',
                document_date: null,
                document_date_text: null,
                document_date_bracketed: false,
                issuing_agency: '',
                note: '',
                created_at: null,
                created_by_name: currentUser?.name ?? '',
                isDraft: true,
            };

            setAllRows((current) => [...current, draftRow]);
            setActiveRowId(draftId);
            focusDocumentRow(draftId);
        } catch (error) {
            alert('Create failed. Please try again.');
        }
    };

    const onDuplicateSelectedRow = async () => {
        if (!selectedRecordId) {
            alert('Vui lòng chọn hồ sơ trước.');
            return;
        }

        const sourceRow = resolveActiveRow();
        if (!sourceRow) {
            alert('Vui lòng chọn dòng tài liệu cần nhân bản trước.');
            return;
        }

        const nextStt = getNextSttForRecord();
        const computedTotalPages = getComputedTotalPages(sourceRow);

        try {
            const response = await window.axios.post('/admin/documents', {
                archive_record_id: selectedRecordId,
                stt: nextStt,
                doc_type_id: sourceRow.doc_type_id ?? defaultDocTypeId ?? null,
                document_number: sourceRow.document_number ?? '',
                document_symbol: sourceRow.document_symbol ?? '',
                document_code: sourceRow.document_code ?? '',
                description: sourceRow.description ?? '',
                signer: sourceRow.signer ?? '',
                author: sourceRow.author ?? '',
                security_level: sourceRow.security_level ?? 'Thường',
                copy_type: sourceRow.copy_type ?? 'Bản chính',
                page_number: sourceRow.page_number ?? '',
                page_number_from: sourceRow.page_number_from ?? '',
                page_number_to: sourceRow.page_number_to ?? '',
                total_pages: computedTotalPages ?? sourceRow.total_pages ?? null,
                file_count: sourceRow.file_count ?? (isDang ? 1 : null),
                file_name: sourceRow.file_name ?? '',
                document_duration: sourceRow.document_duration ?? '',
                usage_mode: sourceRow.usage_mode ?? '',
                keywords: sourceRow.keywords ?? '',
                language: sourceRow.language ?? '',
                handwritten: sourceRow.handwritten ?? '',
                topic: sourceRow.topic ?? '',
                information_code: sourceRow.information_code ?? '',
                reliability_level: sourceRow.reliability_level ?? '',
                physical_condition: sourceRow.physical_condition ?? '',
                document_date: sourceRow.document_date ?? null,
                document_date_text: sourceRow.document_date_text ?? null,
                document_date_bracketed: Boolean(sourceRow.document_date_bracketed),
                issuing_agency: sourceRow.issuing_agency ?? '',
                note: sourceRow.note ?? '',
            });

            const createdRow = response.data;
            setAllRows((current) => [...current, createdRow]);
            setActiveRowId(createdRow.id);
            focusDocumentRow(createdRow.id);
        } catch (error) {
            const message =
                error?.response?.data?.message ||
                Object.values(error?.response?.data?.errors ?? {})
                    .flat()
                    .join('\n') ||
                'Nhân bản thất bại. Vui lòng thử lại.';
            alert(message);
        }
    };

    const onDuplicateContextRow = async (rowId) => {
        if (!selectedRecordId) {
            alert('Vui lòng chọn hồ sơ trước.');
            return;
        }

        const sourceRow = allRows.find(
            (row) =>
                Number(row.id) === Number(rowId) &&
                Number(row.archive_record_id) === Number(selectedRecordId),
        );

        if (!sourceRow) {
            alert('Không tìm thấy dòng cần nhân đôi.');
            return;
        }

        const nextStt = getNextSttForRecord();
        const computedTotalPages = getComputedTotalPages(sourceRow);

        try {
            const response = await window.axios.post('/admin/documents', {
                archive_record_id: selectedRecordId,
                stt: nextStt,
                doc_type_id: sourceRow.doc_type_id ?? defaultDocTypeId ?? null,
                document_number: sourceRow.document_number ?? '',
                document_symbol: sourceRow.document_symbol ?? '',
                document_code: sourceRow.document_code ?? '',
                description: sourceRow.description ?? '',
                signer: sourceRow.signer ?? '',
                author: sourceRow.author ?? '',
                page_number: sourceRow.page_number ?? '',
                security_level: sourceRow.security_level ?? 'Thường',
                copy_type: sourceRow.copy_type ?? 'Bản chính',
                page_number_from: sourceRow.page_number_from ?? '',
                page_number_to: sourceRow.page_number_to ?? '',
                total_pages: computedTotalPages ?? sourceRow.total_pages ?? null,
                file_count: sourceRow.file_count ?? (isDang ? 1 : null),
                file_name: sourceRow.file_name ?? '',
                document_duration: sourceRow.document_duration ?? '',
                usage_mode: sourceRow.usage_mode ?? '',
                keywords: sourceRow.keywords ?? '',
                language: sourceRow.language ?? '',
                handwritten: sourceRow.handwritten ?? '',
                topic: sourceRow.topic ?? '',
                information_code: sourceRow.information_code ?? '',
                reliability_level: sourceRow.reliability_level ?? '',
                physical_condition: sourceRow.physical_condition ?? '',
                document_date: sourceRow.document_date ?? null,
                document_date_text: sourceRow.document_date_text ?? null,
                document_date_bracketed: Boolean(sourceRow.document_date_bracketed),
                issuing_agency: sourceRow.issuing_agency ?? '',
                note: sourceRow.note ?? '',
            });

            const createdRow = response.data;
            setAllRows((current) => [...current, createdRow]);
            setActiveRowId(createdRow.id);
            focusDocumentRow(createdRow.id);
        } catch (error) {
            const message =
                error?.response?.data?.message ||
                Object.values(error?.response?.data?.errors ?? {})
                    .flat()
                    .join('\n') ||
                'Nhân đôi thất bại. Vui lòng thử lại.';
            alert(message);
        }
    };

    const onExportDang = () => {
        window.location.href = '/admin/documents/export-dang';
    };

    const onExportDangRecord = () => {
        if (!selectedRecordId) {
            alert('Vui lòng chọn hồ sơ ở danh sách bên trái trước khi xuất.');
            return;
        }

        const recordId = encodeURIComponent(String(selectedRecordId));
        window.location.href = `/admin/documents/export-dang-record?record_id=${recordId}`;
    };

    const onExportRecord = () => {
        if (!selectedRecordId) {
            alert('Vui lòng chọn hồ sơ ở danh sách bên trái trước khi xuất.');
            return;
        }
        const recordId = encodeURIComponent(String(selectedRecordId));
        window.location.href = `/admin/documents/export-record?record_id=${recordId}`;
    };

    const onOpenImportDang = () => {
        if (!selectedRecordId) {
            alert('Vui lòng chọn hồ sơ ở danh sách bên trái trước khi import.');
            return;
        }

        if (!defaultDocTypeId) {
            alert('Chưa có loại văn bản. Vui lòng tạo Loại văn bản trước.');
            return;
        }

        if (importInputRef.current) {
            importInputRef.current.value = '';
            importInputRef.current.click();
        }
    };

    const onImportDang = async (event) => {
        const file = event?.target?.files?.[0];
        if (!file || !selectedRecordId) {
            return;
        }

        const formData = new FormData();
        formData.append('archive_record_id', String(selectedRecordId));
        formData.append('file', file);

        try {
            const response = await window.axios.post('/admin/documents/import-dang', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            const importedRows = Array.isArray(response?.data?.rows) ? response.data.rows : [];
            if (importedRows.length > 0) {
                setAllRows((current) => sortDocumentRows([...current, ...importedRows]));
                const lastImportedRow = importedRows[importedRows.length - 1];
                if (lastImportedRow?.id) {
                    setActiveRowId(lastImportedRow.id);
                    focusDocumentRow(lastImportedRow.id);
                }
            }

            alert(`Đã import ${response?.data?.count ?? importedRows.length} tài liệu.`);
        } catch (error) {
            const message =
                error?.response?.data?.message ||
                Object.values(error?.response?.data?.errors ?? {})
                    .flat()
                    .join('\n') ||
                'Import failed. Please try again.';
            alert(message);
        } finally {
            if (importInputRef.current) {
                importInputRef.current.value = '';
            }
        }
    };

    const onOpenImportRecord = () => {
        if (!selectedRecordId) {
            alert('Vui lòng chọn hồ sơ ở danh sách bên trái trước khi import.');
            return;
        }
        if (!defaultDocTypeId) {
            alert('Chưa có loại văn bản. Vui lòng tạo Loại văn bản trước.');
            return;
        }
        if (importRecordInputRef.current) {
            importRecordInputRef.current.value = '';
            importRecordInputRef.current.click();
        }
    };

    const onImportRecord = async (event) => {
        const file = event?.target?.files?.[0];
        if (!file || !selectedRecordId) {
            return;
        }

        const formData = new FormData();
        formData.append('archive_record_id', String(selectedRecordId));
        formData.append('file', file);

        try {
            const response = await window.axios.post('/admin/documents/import-record', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            const importedRows = Array.isArray(response?.data?.rows) ? response.data.rows : [];
            if (importedRows.length > 0) {
                setAllRows((current) => sortDocumentRows([...current, ...importedRows]));
                const last = importedRows[importedRows.length - 1];
                if (last?.id) {
                    setActiveRowId(last.id);
                    focusDocumentRow(last.id);
                }
            }

            alert(`Đã import ${response?.data?.count ?? importedRows.length} tài liệu.`);
        } catch (error) {
            const message =
                error?.response?.data?.message ||
                Object.values(error?.response?.data?.errors ?? {})
                    .flat()
                    .join('\n') ||
                'Import thất bại. Vui lòng thử lại.';
            alert(message);
        } finally {
            if (importRecordInputRef.current) {
                importRecordInputRef.current.value = '';
            }
        }
    };

    const onSearchRecords = () => {
        setRecordSearchKeyword(recordSearchInput.trim().toLowerCase());
    };

    const removeRowsFromState = (idKeys) => {
        if (!idKeys?.length) {
            return;
        }
        const idSet = new Set(idKeys.map((id) => String(id)));
        setAllRows((current) => current.filter((row) => !idSet.has(String(row.id))));
        setSelectedRowIds((current) => current.filter((id) => !idSet.has(String(id))));
        setRowContextMenu((current) =>
            current.visible
                ? { ...current, selectedIds: current.selectedIds.filter((id) => !idSet.has(String(id))) }
                : current,
        );
        setActiveRowId((current) => (current !== null && idSet.has(String(current)) ? null : current));
    };

    const deleteRowsByIds = async (ids) => {
        const uniqueIds = Array.from(
            new Set(
                (ids ?? [])
                    .filter((id) => id !== null && id !== undefined)
                    .map((id) => String(id)),
            ),
        );
        if (uniqueIds.length === 0) {
            return { deletedCount: 0, failedCount: 0 };
        }

        const targetRows = allRows.filter((row) => uniqueIds.includes(String(row.id)));
        const draftIds = targetRows.filter((row) => row?.isDraft).map((row) => String(row.id));
        const persistedIds = targetRows
            .filter((row) => !row?.isDraft)
            .map((row) => row.id);

        const deletedPersistedIds = [];
        let failedCount = 0;

        if (persistedIds.length > 0) {
            const results = await Promise.allSettled(
                persistedIds.map((id) => window.axios.delete(`/admin/documents/${id}`)),
            );
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    deletedPersistedIds.push(String(persistedIds[index]));
                } else {
                    failedCount += 1;
                }
            });
        }

        const deletedIds = [...draftIds, ...deletedPersistedIds];
        removeRowsFromState(deletedIds);

        return { deletedCount: deletedIds.length, failedCount };
    };

    const onDelete = async (id) => {
        const target = allRows.find((row) => Number(row.id) === Number(id));
        if (target && !canWriteDocument(target)) {
            alert('Bạn chỉ được xóa tài liệu do chính bạn tạo.');
            return;
        }

        if (!confirm('Delete this row?')) {
            return;
        }
        const { failedCount } = await deleteRowsByIds([id]);
        if (failedCount > 0) {
            alert('Delete failed. Please try again.');
        }
    };

    const onDeleteSelectedRows = async (ids) => {
        const uniqueIds = Array.from(
            new Set(
                (ids ?? [])
                    .filter((id) => id !== null && id !== undefined)
                    .map((id) => String(id)),
            ),
        );
        if (uniqueIds.length === 0) {
            return;
        }

        const forbiddenIds = uniqueIds.filter((id) => {
            const row = allRows.find((item) => String(item.id) === String(id));
            return row ? !canWriteDocument(row) : false;
        });
        if (forbiddenIds.length > 0) {
            alert('Có tài liệu không thuộc quyền của bạn. Chỉ có thể xóa tài liệu do bạn tạo.');
            return;
        }

        const confirmed =
            uniqueIds.length === 1
                ? confirm('Delete this row?')
                : confirm(`Delete ${uniqueIds.length} selected rows?`);
        if (!confirmed) {
            return;
        }

        const { failedCount } = await deleteRowsByIds(uniqueIds);
        if (failedCount > 0) {
            alert(`Delete finished with ${failedCount} failed row(s).`);
        }
    };

    useEffect(() => {
        const handleKeyDown = (event) => {
            const target = event.target;
            const isTypingTarget =
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target instanceof HTMLSelectElement ||
                target?.isContentEditable;

            if (isTypingTarget) {
                return;
            }

            const key = String(event.key || '').toLowerCase();

            if (key === 'f2' && !event.repeat) {
                if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
                    return;
                }
                event.preventDefault();
                onAddRow();
                return;
            }

            if ((event.ctrlKey || event.metaKey) && key === 'b' && !event.repeat) {
                if (event.altKey || event.shiftKey) {
                    return;
                }
                event.preventDefault();
                onDuplicateSelectedRow();
                return;
            }

            if (key === 'delete' && !event.repeat) {
                if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
                    return;
                }

                const apiSelectedIds = getSelectedRowIdsFromApi(gridApiRef.current);
                const selectedIds =
                    apiSelectedIds.length > 0
                        ? apiSelectedIds
                        : selectedRowIds.length > 0
                            ? selectedRowIds.map((id) => String(id))
                            : activeRowId !== null && activeRowId !== undefined
                                ? [String(activeRowId)]
                                : [];

                if (selectedIds.length === 0) {
                    return;
                }

                event.preventDefault();
                closeRowContextMenu();
                onDeleteSelectedRows(selectedIds);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [activeRowId, onAddRow, onDeleteSelectedRows, onDuplicateSelectedRow, selectedRowIds]);

    const qrData = qrPreviewRow ? buildQrData(qrPreviewRow) : null;
    const canDuplicateFromContextMenu =
        rowContextMenu.selectedIds.length <= 1 &&
        rowContextMenu.rowId !== null &&
        rowContextMenu.rowId !== undefined;

    return (
        <AdminLayout title="Biên mục tài liệu">
            <Head title="Biên mục tài liệu" />

            <div className="flex h-[calc(100vh-170px)] min-h-[720px] gap-6">
                <div className="flex h-full w-[200px] flex-col rounded-3xl border border-[var(--panel-border)] bg-white/90 p-4 shadow-[0_18px_40px_rgba(45,28,17,0.08)]">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                        Chọn mục lục
                    </div>
                    <select
                        value={selectedItemId ?? ''}
                        onChange={(event) => setSelectedItemId(event.target.value)}
                        className="mt-3 w-full rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-[var(--text-main)]"
                    >
                        {itemOptions.length === 0 && <option value="">Không có mục lục</option>}
                        {itemOptions.map((item) => (
                            <option key={item.value} value={item.value}>
                                {item.label}
                            </option>
                        ))}
                    </select>

                    <div className="mt-6 text-sm font-semibold text-[var(--text-muted)]">Danh sách hồ sơ</div>
                    <div className="mt-3 flex items-center gap-2">
                        <input
                            type="text"
                            value={recordSearchInput}
                            onChange={(event) => setRecordSearchInput(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    onSearchRecords();
                                }
                            }}
                            placeholder="Tìm số hồ sơ..."
                            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-[var(--text-main)]"
                        />
                        <button
                            type="button"
                            onClick={onSearchRecords}
                            className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-[var(--text-main)]"
                        >
                            Tìm
                        </button>
                    </div>
                    <div ref={recordListRef} className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                        {filteredRecordsForSelectedItem.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-stone-200 px-4 py-6 text-sm text-[var(--text-muted)]">
                                {recordsForSelectedItem.length === 0
                                    ? 'Không có hồ sơ trong mục lục này.'
                                    : 'Không tìm thấy hồ sơ phù hợp.'}
                            </div>
                        )}
                        {filteredRecordsForSelectedItem.map((record) => (
                            <button
                                key={record.id}
                                type="button"
                                data-record-id={String(record.id)}
                                onClick={() => setSelectedRecordId(record.id)}
                                className={`w-full rounded-2xl px-4 py-3 text-left text-sm transition ${
                                    record.id === selectedRecordId
                                        ? 'bg-[var(--accent)] text-white shadow-lg'
                                        : 'border border-stone-200 bg-white text-[var(--text-main)] hover:bg-stone-50'
                                }`}
                            >
                                <div className="font-semibold">
                                    {getRecordCode(record)}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="min-w-0 flex h-full flex-1 flex-col rounded-3xl border border-[var(--panel-border)] bg-white/90 p-6 shadow-[0_18px_40px_rgba(45,28,17,0.08)]">
                    <div className="mb-4 flex items-center justify-between">
                        <div className="text-sm font-semibold text-[var(--text-muted)]">
                            Danh sách tài liệu
                        </div>
                        <div className="flex items-center gap-2">
                            {isDang && (
                                <>
                                    <input
                                        ref={importInputRef}
                                        type="file"
                                        accept=".xlsx,.xls,.csv"
                                        className="hidden"
                                        onChange={onImportDang}
                                    />
                                    <button
                                        type="button"
                                        onClick={onOpenImportDang}
                                        disabled={!selectedRecordId}
                                        className="rounded-full border border-stone-300 bg-white px-5 py-2 text-sm font-semibold text-[var(--text-main)] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Import Excel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onExportDang}
                                        className="rounded-full border border-stone-300 bg-white px-5 py-2 text-sm font-semibold text-[var(--text-main)]"
                                    >
                                        Xuất Excel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onExportDangRecord}
                                        disabled={!selectedRecordId}
                                        className="rounded-full border border-stone-300 bg-white px-5 py-2 text-sm font-semibold text-[var(--text-main)] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Xuất Excel hồ sơ
                                    </button>
                                </>
                            )}
                            <input
                                ref={importRecordInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                className="hidden"
                                onChange={onImportRecord}
                            />
                            <button
                                type="button"
                                onClick={onOpenImportRecord}
                                disabled={!selectedRecordId}
                                className="rounded-full border border-stone-300 bg-white px-5 py-2 text-sm font-semibold text-[var(--text-main)] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Import
                            </button>
                            <button
                                type="button"
                                onClick={onExportRecord}
                                disabled={!selectedRecordId}
                                className="rounded-full border border-stone-300 bg-white px-5 py-2 text-sm font-semibold text-[var(--text-main)] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Xuất Excel
                            </button>
                            <button
                                type="button"
                                onClick={onAddRow}
                                title="Phím tắt F2, nhân bản dòng: Ctrl+B"
                                className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white"
                            >
                                Thêm tài liệu
                            </button>
                        </div>
                    </div>
                    <div
                        className={`documents-grid ag-theme-quartz min-h-0 flex-1 overflow-hidden rounded-2xl border border-stone-200 ${
                            useLegacyGridScrollbarFallback ? 'legacy-grid-scrollbars' : isWindows7 ? 'win7-grid-scrollbars' : ''
                        }`}
                        style={
                            useLegacyGridScrollbarFallback
                                ? {
                                      height: 'calc(100vh - 300px)',
                                      minHeight: '420px',
                                      maxHeight: 'calc(100vh - 300px)',
                                      overflowY: 'auto',
                                      overflowX: 'auto',
                                  }
                                : isWindows7
                                  ? {
                                        height: 'calc(100vh - 300px)',
                                        minHeight: '420px',
                                        maxHeight: 'calc(100vh - 300px)',
                                    }
                                : undefined
                        }
                    >
                        <div
                            className={useLegacyGridScrollbarFallback ? 'min-h-full min-w-full' : 'h-full w-full'}
                            onContextMenuCapture={(event) => {
                                event.preventDefault();
                            }}
                        >
                            <AgGridReact
                            columnDefs={columnDefs}
                            rowData={filteredRows}
                            getRowId={({ data }) => String(data.id)}
                            onGridReady={(params) => {
                                gridApiRef.current = params.api;
                                if (!useLegacyGridScrollbarFallback) {
                                    attachWin7ScrollbarObserver(params.api);
                                    scheduleForceWin7Scrollbars(params.api);
                                }
                            }}
                            onFirstDataRendered={(params) => {
                                if (!useLegacyGridScrollbarFallback) {
                                    scheduleForceWin7Scrollbars(params.api);
                                }
                            }}
                            onModelUpdated={(params) => {
                                if (!useLegacyGridScrollbarFallback) {
                                    scheduleForceWin7Scrollbars(params.api);
                                }
                            }}
                            onCellClicked={(params) => {
                                if (params?.data?.id !== undefined && params?.data?.id !== null) {
                                    setActiveRowId(params.data.id);
                                }
                                const api = params?.api;
                                const node = params?.node;
                                if (!api || !node) {
                                    return;
                                }

                                const nativeEvent = params?.event;
                                const isMultiSelectClick = Boolean(
                                    nativeEvent?.ctrlKey || nativeEvent?.metaKey,
                                );

                                if (isMultiSelectClick) {
                                    node.setSelected(!node.isSelected());
                                } else {
                                    api.deselectAll();
                                    node.setSelected(true);
                                }

                                setSelectedRowIds(getSelectedRowIdsFromApi(api));
                            }}
                            onSelectionChanged={(event) => {
                                setSelectedRowIds(getSelectedRowIdsFromApi(event?.api));
                            }}
                            onCellFocused={(event) => {
                                const rowIndex = event?.rowIndex;
                                const api = event?.api;
                                if (rowIndex === null || rowIndex === undefined || rowIndex < 0 || !api) {
                                    return;
                                }
                                const rowNode = api.getDisplayedRowAtIndex(rowIndex);
                                if (rowNode?.data?.id !== undefined && rowNode?.data?.id !== null) {
                                    setActiveRowId(rowNode.data.id);
                                }
                            }}
                            onCellContextMenu={(params) => {
                                if (!params?.data?.id) {
                                    return;
                                }
                                const rowIdKey = String(params.data.id);
                                const currentSelectedIds = getSelectedRowIdsFromApi(params.api);
                                if (!currentSelectedIds.includes(rowIdKey)) {
                                    applySelection(params.api, [rowIdKey]);
                                }
                                setActiveRowId(params.data.id);
                                openRowContextMenu(params.event, params.data.id, params.api);
                            }}
                            rowSelection="multiple"
                            suppressRowClickSelection
                            suppressContextMenu
                            alwaysShowHorizontalScroll={isWindows7 && !useLegacyGridScrollbarFallback}
                            alwaysShowVerticalScroll={isWindows7 && !useLegacyGridScrollbarFallback}
                            scrollbarWidth={isWindows7 && !useLegacyGridScrollbarFallback ? 16 : undefined}
                            domLayout={useLegacyGridScrollbarFallback ? 'autoHeight' : 'normal'}
                            defaultColDef={{
                                sortable: false,
                                filter: false,
                                resizable: true,
                                editable: true,
                                suppressHeaderMenuButton: true,
                                minWidth: 100,
                                maxWidth: 560,
                            }}
                            pagination
                            paginationPageSize={10}
                            onCellValueChanged={onCellValueChanged}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {rowContextMenu.visible && (
                <div
                    ref={contextMenuRef}
                    className="fixed z-50 min-w-[170px] rounded-xl border border-stone-200 bg-white py-1 shadow-xl"
                    style={{ top: `${rowContextMenu.y}px`, left: `${rowContextMenu.x}px` }}
                    onClick={(event) => event.stopPropagation()}
                    onMouseDown={(event) => event.stopPropagation()}
                    onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                    }}
                >
                    
                        <button
                            type="button"
                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[var(--text-main)] before:content-['⧉'] before:text-sm before:leading-none hover:bg-stone-100"
                            disabled={!canDuplicateFromContextMenu}
                            style={!canDuplicateFromContextMenu ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
                            onClick={async () => {
                                if (!canDuplicateFromContextMenu) {
                                    return;
                                }
                                const targetRowId = rowContextMenu.rowId;
                                closeRowContextMenu();
                                if (targetRowId !== null && targetRowId !== undefined) {
                                    await onDuplicateContextRow(targetRowId);
                                }
                            }}
                        >
                            Nhân đôi
                        </button>
                        <button
                            type="button"
                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-rose-600 before:content-['🗑'] before:text-sm before:leading-none hover:bg-rose-50"
                            onClick={async () => {
                                const targetIds =
                                    rowContextMenu.selectedIds.length > 1
                                        ? rowContextMenu.selectedIds
                                        : [rowContextMenu.rowId];
                                closeRowContextMenu();
                                if (targetIds.some((id) => id !== null && id !== undefined)) {
                                    await onDeleteSelectedRows(targetIds);
                                }
                            }}
                        >
                            Xóa dòng
                        </button>
                </div>
            )}

            {qrPreviewRow && qrData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
                        <div className="mb-4 flex items-start justify-between">
                            <div>
                                <h3 className="text-4xl font-semibold text-[var(--text-main)]">QR tài liệu</h3>
                                <p className="mt-1 text-sm text-[var(--text-muted)]">
                                    Mở màn hình này để quét QR lớn, ổn định hơn so với QR nhỏ trong bảng.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setQrPreviewRow(null)}
                                className="rounded-full border border-stone-300 px-4 py-1 text-sm font-semibold text-[var(--text-main)]"
                            >
                                Đóng
                            </button>
                        </div>

                        <div className="flex justify-center">
                            <div className="rounded-2xl border border-stone-200 p-3">
                                <img src={qrData.imageUrl} alt="QR tài liệu" className="h-[340px] w-[340px]" />
                            </div>
                        </div>

                        <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-lg leading-8 text-[var(--text-main)]">
                            {qrData.lines.map((line, index) => (
                                <div key={`${line}-${index}`}>- {line}</div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
