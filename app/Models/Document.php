<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Document extends Model
{
    use HasFactory;

    protected $fillable = [
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
    ];
}
