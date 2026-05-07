<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('archive_record_items', function (Blueprint $table) {
            $table->id();
            $table->string('archive_record_item_code');
            $table->foreignId('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->integer('page_num')->nullable();
            $table->string('document_date')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('archive_record_items');
    }
};
