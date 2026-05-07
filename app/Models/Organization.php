<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Organization extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'archival_id',
        'name',
        'type',
        'archivals_time',
        'key_groups',
    ];

    public function archival(): BelongsTo
    {
        return $this->belongsTo(Archival::class);
    }
}
