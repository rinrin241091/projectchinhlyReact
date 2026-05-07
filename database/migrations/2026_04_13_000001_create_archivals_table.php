<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('archivals', function (Blueprint $table) {
            $table->id();
            $table->string('identifier', 20)->comment('Ma co quan luu tru');
            $table->string('name')->comment('Ten co quan luu tru');
            $table->string('address')->nullable()->comment('Dia chi');
            $table->string('phone', 20)->nullable()->comment('So dien thoai');
            $table->string('email', 100)->nullable()->comment('Email lien he');
            $table->string('manager', 100)->nullable()->comment('Ten nguoi phu trach');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('archivals');
    }
};
