<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Storage extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'name',
        'location',
        'archival_id',
    ];

    public function archival()
    {
        return $this->belongsTo(Archival::class);
    }
}
