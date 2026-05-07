<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Box extends Model
{
    use HasFactory;

    protected $fillable = [
        'shelf_id',
        'code',
        'description',
        'type',
        'record_count',
        'page_count',
        'location',
        'status',
    ];

    public function shelf()
    {
        return $this->belongsTo(Shelf::class);
    }
}
