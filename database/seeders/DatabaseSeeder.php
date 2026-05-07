<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Archival;
use App\Models\Organization;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        User::query()->updateOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name' => 'Admin',
                'password' => Hash::make('password'),
                'role' => 'admin',
            ],
        );

        User::query()->updateOrCreate(
            ['email' => 'user@example.com'],
            [
                'name' => 'User',
                'password' => Hash::make('password'),
                'role' => 'user',
            ],
        );

        Archival::query()->updateOrCreate(
            ['identifier' => '3.000.25.27.HI7'],
            [
                'name' => 'UBND phuong Phuoc My',
                'address' => '289 Nguyen Cong Tru, Phuong Phuoc My, Quan Son Tra, Da Nang',
                'phone' => '0768508684',
                'email' => '',
                'manager' => 'Ms. Ngo Nguyet',
            ],
        );
        Archival::query()->updateOrCreate(
            ['identifier' => '3.000.07.27.HI7'],
            [
                'name' => 'Phong Lao dong - Thuong binh va Xa hoi quan Son Tra',
                'address' => '23 Tran Nhan Tong, phuong Man Thai, quan Son Tra, TP. Da Nang',
                'phone' => '',
                'email' => '',
                'manager' => '',
            ],
        );
        Archival::query()->updateOrCreate(
            ['identifier' => '3.000.10.27.HI7'],
            [
                'name' => 'Phong Tai chinh - Ke hoach quan Son Tra',
                'address' => '02 Dong Giang, quan Son Tra, TP Da Nang',
                'phone' => '',
                'email' => '',
                'manager' => '',
            ],
        );
        Archival::query()->updateOrCreate(
            ['identifier' => '3.000.11.27.HI7'],
            [
                'name' => 'Phong Tai nguyen va Moi truong quan Son Tra',
                'address' => '02 Dong Giang, quan Son Tra, TP Da Nang',
                'phone' => '',
                'email' => '',
                'manager' => '',
            ],
        );
        Archival::query()->updateOrCreate(
            ['identifier' => 'A47.34.31'],
            [
                'name' => 'Dang uy Xa Hung',
                'address' => 'Xa Za Hung, huyen Dong Giang, tinh Quang Nam',
                'phone' => '',
                'email' => '',
                'manager' => '',
            ],
        );

        $archivalId = Archival::query()->value('id');
        if ($archivalId) {
            Organization::query()->updateOrCreate(
                ['code' => '001'],
                [
                    'archival_id' => $archivalId,
                    'name' => 'UBND phuong Phuoc My',
                    'archivals_time' => '2005-2015',
                    'key_groups' => '',
                ],
            );
            Organization::query()->updateOrCreate(
                ['code' => '002'],
                [
                    'archival_id' => $archivalId,
                    'name' => 'Phong Lao dong - Thuong binh va Xa hoi quan Son Tra',
                    'archivals_time' => '2009-2015',
                    'key_groups' => '',
                ],
            );
            Organization::query()->updateOrCreate(
                ['code' => '003'],
                [
                    'archival_id' => $archivalId,
                    'name' => 'Phong Tai chinh - Ke hoach quan Son Tra',
                    'archivals_time' => '2005-2009',
                    'key_groups' => '',
                ],
            );
            Organization::query()->updateOrCreate(
                ['code' => '004'],
                [
                    'archival_id' => $archivalId,
                    'name' => 'Phong Tai nguyen va Moi truong quan Son Tra',
                    'archivals_time' => '2013-2015',
                    'key_groups' => '',
                ],
            );
            Organization::query()->updateOrCreate(
                ['code' => '006'],
                [
                    'archival_id' => $archivalId,
                    'name' => 'Dang uy Xa Hung',
                    'archivals_time' => '2008-2025',
                    'key_groups' => '',
                ],
            );
        }
    }
}
