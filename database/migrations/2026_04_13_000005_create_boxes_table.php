<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('boxes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shelf_id')->constrained('shelves')->cascadeOnDelete();
            $table->string('code');
            $table->string('description');
            $table->string('type')->nullable();
            $table->integer('record_count')->nullable();
            $table->integer('page_count')->nullable();
            $table->string('location')->nullable();
            $table->string('status')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('boxes');
    }
};
