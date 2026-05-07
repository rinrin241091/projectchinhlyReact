<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->string('document_date_text')->nullable()->after('document_date');
            $table->boolean('document_date_bracketed')->default(false)->after('document_date_text');
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropColumn(['document_date_text', 'document_date_bracketed']);
        });
    }
};

