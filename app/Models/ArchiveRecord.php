<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ArchiveRecord extends Model
{
    use HasFactory;

    protected $fillable = [
        'reference_code',
        'code',
        'organization_id',
        'box_id',
        'storage_id',
        'archive_record_item_id',
        'symbols_code',
        'title',
        'description',
        'start_date',
        'end_date',
        'language',
        'handwritten',
        'usage_mode',
        'record_type_id',
        'work_area_id',
        'department_id',
        'preservation_duration',
        'page_count',
        'condition',
        'note',
        'status',
    ];
}
