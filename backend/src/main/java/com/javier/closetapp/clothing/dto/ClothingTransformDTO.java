package com.javier.closetapp.clothing.dto;

// A garment's placement on the persona: position (x, y), scale, rotation, size, opacity and
// flips, plus the optional crop rectangle (mask*) made in the fitting studio. All numbers are
// in the 750 x 1000 virtual canvas the editors use.
public class ClothingTransformDTO {
    private Double x;
    private Double y;
    private Double scale;
    private Double scaleX;
    private Double scaleY;
    private Double rotation;
    private Double width;
    private Double height;
    private Double opacity;
    private Boolean flipX;
    private Boolean flipY;
    private Double maskTop;
    private Double maskLeft;
    private Double maskWidth;
    private Double maskHeight;

    public ClothingTransformDTO() {}

    public ClothingTransformDTO(Double x, Double y, Double scale, Double rotation, Double width, Double height) {
        this.x = x;
        this.y = y;
        this.scale = scale;
        this.rotation = rotation;
        this.width = width;
        this.height = height;
    }

    public Double getX() { return x; }
    public void setX(Double x) { this.x = x; }

    public Double getY() { return y; }
    public void setY(Double y) { this.y = y; }

    public Double getScale() { return scale; }
    public void setScale(Double scale) { this.scale = scale; }

    public Double getScaleX() { return scaleX; }
    public void setScaleX(Double scaleX) { this.scaleX = scaleX; }

    public Double getScaleY() { return scaleY; }
    public void setScaleY(Double scaleY) { this.scaleY = scaleY; }

    public Double getRotation() { return rotation; }
    public void setRotation(Double rotation) { this.rotation = rotation; }

    public Double getWidth() { return width; }
    public void setWidth(Double width) { this.width = width; }

    public Double getHeight() { return height; }
    public void setHeight(Double height) { this.height = height; }

    public Double getOpacity() { return opacity; }
    public void setOpacity(Double opacity) { this.opacity = opacity; }

    public Boolean getFlipX() { return flipX; }
    public void setFlipX(Boolean flipX) { this.flipX = flipX; }

    public Boolean getFlipY() { return flipY; }
    public void setFlipY(Boolean flipY) { this.flipY = flipY; }

    public Double getMaskTop() { return maskTop; }
    public void setMaskTop(Double maskTop) { this.maskTop = maskTop; }

    public Double getMaskLeft() { return maskLeft; }
    public void setMaskLeft(Double maskLeft) { this.maskLeft = maskLeft; }

    public Double getMaskWidth() { return maskWidth; }
    public void setMaskWidth(Double maskWidth) { this.maskWidth = maskWidth; }

    public Double getMaskHeight() { return maskHeight; }
    public void setMaskHeight(Double maskHeight) { this.maskHeight = maskHeight; }
}
