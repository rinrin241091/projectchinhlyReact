<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('archive_records', function (Blueprint $table) {
            $table->id();
            $table->string('reference_code')->unique();
            $table->string('code')->nullable();
            $table->unsignedBigInteger('organization_id')->nullable();
            $table->unsignedBigInteger('box_id')->nullable();
            $table->unsignedBigInteger('storage_id')->nullable();
            $table->unsignedBigInteger('archive_record_item_id')->nullable();
            $table->integer('symbols_code')->nullable();
            $table->string('title');
            $table->text('description')->nullable();
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->string('language')->nullable();
            $table->string('handwritten')->nullable();
            $table->string('usage_mode')->nullable();
            $table->unsignedBigInteger('record_type_id')->nullable();
            $table->unsignedBigInteger('work_area_id')->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->string('preservation_duration')->nullable();
            $table->integer('page_count')->nullable();
            $table->string('condition')->nullable();
            $table->text('note')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('archive_records');
    }
};
