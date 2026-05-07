<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('archive_record_id')->nullable();
            $table->unsignedInteger('stt')->nullable();
            $table->unsignedBigInteger('doc_type_id')->nullable();
            $table->string('document_number')->nullable();
            $table->string('document_symbol')->nullable();
            $table->string('document_code')->nullable();
            $table->text('description')->nullable();
            $table->string('signer')->nullable();
            $table->text('author')->nullable();
            $table->string('security_level')->nullable();
            $table->string('copy_type')->nullable();
            $table->string('page_number')->nullable();
            $table->unsignedInteger('total_pages')->nullable();
            $table->unsignedInteger('file_count')->nullable();
            $table->string('file_name')->nullable();
            $table->string('document_duration')->nullable();
            $table->string('usage_mode')->nullable();
            $table->text('keywords')->nullable();
            $table->string('language')->nullable();
            $table->string('handwritten')->nullable();
            $table->string('topic')->nullable();
            $table->string('information_code')->nullable();
            $table->string('reliability_level')->nullable();
            $table->string('physical_condition')->nullable();
            $table->date('document_date')->nullable();
            $table->string('issuing_agency')->nullable();
            $table->string('note')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};
