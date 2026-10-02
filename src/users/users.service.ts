import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  list(): Promise<User[]> {
    return this.usersRepository.find();
  }

  async find(id: number): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) {
      throw new NotFoundException(`User with ID '${id}' could not be found.`);
    }

    return user;
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existingUser = await this.usersRepository.findOneBy({
      email: createUserDto.email,
    });
    if (existingUser) {
      throw new ConflictException(
        `User with email '${createUserDto.email}' already exists.`,
      );
    }

    const newUser = this.usersRepository.create({
      ...createUserDto,
      createdAt: new Date(),
    });

    return this.usersRepository.save(newUser);
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
    const userToUpdate = await this.usersRepository.findOneBy({ id });
    if (!userToUpdate) {
      throw new NotFoundException(`User with ID '${id}' could not be found.`);
    }

    return this.usersRepository.save({
      ...userToUpdate,
      ...updateUserDto,
      updatedAt: new Date(),
    });
  }

  async delete(id: number): Promise<User> {
    const userToDelete = await this.usersRepository.findOneBy({ id });
    if (!userToDelete) {
      throw new NotFoundException(`User with ID '${id}' could not be found.`);
    }

    return this.usersRepository.remove(userToDelete);
  }
}
