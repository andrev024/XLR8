import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'piloto@xlr8.app' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'contraseña-segura', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Piloto XLR8' })
  @IsString()
  displayName!: string;
}
