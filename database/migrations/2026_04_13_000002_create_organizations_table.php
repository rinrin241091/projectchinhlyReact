<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organizations', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->foreignId('archival_id')->constrained('archivals')->cascadeOnDelete();
            $table->string('name');
            $table->string('type', 20)->nullable()->comment('Loai phong: Dang hoac Chinh quyen');
            $table->string('archivals_time');
            $table->longText('key_groups')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('organizations');
    }
};
