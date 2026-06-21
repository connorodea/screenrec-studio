import CoreGraphics

/// Which corner the webcam "bubble" sits in.
enum PiPCorner: CaseIterable, Sendable {
    case topLeft, topRight, bottomLeft, bottomRight
}

/// Pure geometry for the webcam picture-in-picture bubble. Computes the bubble's
/// frame within a canvas of backing pixels so the compositing step (a later,
/// visually-verified sprint) and any UI preview agree on placement.
///
/// Coordinate convention: origin top-left, +x right, +y down (screen/pixel space).
/// The bubble is square (a circular crop fits inside it).
struct PiPLayout: Sendable {
    /// Bubble height as a fraction of the canvas height (e.g. 0.2 = 20%).
    var sizeFraction: Double
    /// Inset from the canvas edges, in pixels.
    var margin: Double
    var corner: PiPCorner

    init(corner: PiPCorner, sizeFraction: Double, margin: Double) {
        self.corner = corner
        self.sizeFraction = sizeFraction
        self.margin = margin
    }

    /// The bubble's frame within `canvas`. The size is clamped so the bubble plus
    /// its margins always fit, even if `sizeFraction` is absurdly large.
    func frame(in canvas: PixelSize) -> CGRect {
        let w = Double(canvas.width)
        let h = Double(canvas.height)

        let maxSize = max(0, min(w, h) - 2 * margin)
        let size = min(h * sizeFraction, maxSize)

        let x: Double
        let y: Double
        switch corner {
        case .topLeft:     x = margin;            y = margin
        case .topRight:    x = w - size - margin; y = margin
        case .bottomLeft:  x = margin;            y = h - size - margin
        case .bottomRight: x = w - size - margin; y = h - size - margin
        }
        return CGRect(x: x, y: y, width: size, height: size)
    }

    /// The largest circle fits inside the (square) bubble, so the crop rect is the
    /// bubble frame itself.
    func circularCropRect(in canvas: PixelSize) -> CGRect {
        frame(in: canvas)
    }
}
