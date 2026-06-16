import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

interface AuthRequest extends Request {
  user: { userId: string };
}

/**
 * CategoriesController — endpoints CRUD + reactivate de categorías.
 *
 * Todas las rutas están protegidas por JwtAuthGuard (global).
 * El userId se extrae SIEMPRE de request.user.userId (nunca del body/query).
 */
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /**
   * GET /categories
   * Lista las categorías ACTIVAS del usuario con contador de movimientos (RF-CAT-006).
   * Orden: nombre ascendente.
   */
  @Get()
  findAll(@Request() req: AuthRequest) {
    return this.categoriesService.findAll(req.user.userId);
  }

  /**
   * POST /categories
   * Crea una categoría nueva (flujo crear-o-reactivar, RF-CAT-002).
   * - Sin colisión: crea y devuelve 201.
   * - Colisión con activa: 409 con mensaje de duplicado.
   * - Colisión con eliminada: 409 con payload { reactivable: true, category: {...} }.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Request() req: AuthRequest, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(req.user.userId, dto);
  }

  /**
   * POST /categories/:id/reactivate
   * Reactiva una categoría ELIMINADA del usuario (RF-CAT-002 A3.1).
   * La categoría vuelve exactamente como estaba (mismo id, scope, color, name).
   * No acepta body.
   */
  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  reactivate(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.categoriesService.reactivate(req.user.userId, id);
  }

  /**
   * PATCH /categories/:id
   * Edita nombre, scope y/o color de una categoría activa del usuario (RF-CAT-003).
   * El color debe pertenecer a la paleta de 70 colores (COLOR_MATRIX); hex libre → 400.
   */
  @Patch(':id')
  update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(req.user.userId, id, dto);
  }

  /**
   * DELETE /categories/:id
   * Soft delete: marca deletedAt = now (RF-CAT-004).
   * Si la categoría ya está eliminada → 404 (no idempotente).
   * Devuelve 204 No Content.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.categoriesService.remove(req.user.userId, id);
  }
}
