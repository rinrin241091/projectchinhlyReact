<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('archive_records', 'status')) {
            Schema::table('archive_records', function (Blueprint $table) {
                $table->string('status')->nullable()->after('note');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('archive_records', 'status')) {
            Schema::table('archive_records', function (Blueprint $table) {
                $table->dropColumn('status');
            });
        }
    }
};

