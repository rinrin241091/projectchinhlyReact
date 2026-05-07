<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ArchiveRecordItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'archive_record_item_code',
        'organization_id',
        'title',
        'description',
        'page_num',
        'document_date',
    ];

    public function organization()
    {
        return $this->belongsTo(Organization::class);
    }
}
