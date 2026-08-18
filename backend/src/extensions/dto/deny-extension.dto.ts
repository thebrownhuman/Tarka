import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DenyExtensionDto {
  @IsString()
  @IsNotEmpty({ message: 'request_id is required' })
  request_id!: string;

  @IsOptional()
  @IsString()
  admin_note?: string;
}
